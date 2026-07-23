import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Fastify from "fastify";
import { loadServerEnv, parseAllowedOrigins, resolvePort, toApiError } from "@investiq/shared";

// Local dev convenience: load the monorepo-root .env if present. In production
// (Railway) NODE_ENV=production and vars come from the platform, so this is a
// no-op (the file is absent / gitignored).
if (process.env.NODE_ENV !== "production") {
  // process.loadEnvFile exists at runtime (Node 20.12+) but may be absent from
  // the pinned @types/node, so access it defensively.
  const loadEnvFile = (process as { loadEnvFile?: (path: string) => void }).loadEnvFile;
  if (loadEnvFile) {
    try {
      const here = dirname(fileURLToPath(import.meta.url));
      loadEnvFile.call(process, resolve(here, "../../../.env"));
    } catch {
      // no .env file — rely on the ambient environment
    }
  }
}
import { makeClerkVerifier, makeClerkClient } from "./lib/context.js";
import { resolveAuthContext, type AuthDeps } from "./lib/guard.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { adminRoutes } from "./routes/admin.js";
import { learningRoutes } from "./routes/learning.js";
import { glossaryRoutes } from "./routes/glossary.js";
import { forexRoutes } from "./routes/forex.js";
import {
  createExchangeRateService,
  createNullRateProvider,
  createTwelveDataRateProvider,
} from "./services/exchange-rates.js";
import { createCalendarService } from "./services/calendar.js";
import { createForexFactoryCalendarProvider } from "./services/calendar-ff.js";
import { createForexMarketService } from "./services/forex-market.js";
import { createAnthropicAdvisor } from "@investiq/ai";
import { createAdvisorService } from "./services/advisor.js";
import { advisorRoutes } from "./routes/advisor.js";
import { quantLabRoutes } from "./routes/quant-lab.js";
// NOTE (forex refactor): the stock/ETF feature set is DORMANT, not deleted.
// Its routes (symbols, market, watchlists, connections, analysis, portfolio,
// reviews, risk, chart, opportunities, paper, discovery, news, cron scan,
// macro, filings, scorecard) are no longer registered; the files, services,
// and DB tables remain in the tree for archive/reference.

/**
 * InvestIQ API. Boots with FAIL-FAST env validation. Every protected route
 * follows: authenticate -> authorize -> validate -> business logic -> response.
 */
async function main() {
  // STARTUP: validate env; missing/invalid vars crash the process immediately.
  const env = loadServerEnv();
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  const clerkVerifier = makeClerkVerifier(env.CLERK_SECRET_KEY);
  const clerk = makeClerkClient(env.CLERK_SECRET_KEY);
  const authDeps: AuthDeps = { verifier: clerkVerifier, clerk };

  // Exchange rates: provider-agnostic. Live automatically when the Twelve Data
  // key is present (set FOREX_LIVE_RATES=false to force manual-rate mode).
  const rateProvider =
    env.TWELVEDATA_API_KEY && process.env.FOREX_LIVE_RATES !== "false"
      ? createTwelveDataRateProvider(env.TWELVEDATA_API_KEY)
      : createNullRateProvider();
  const rates = createExchangeRateService(rateProvider);

  // Forex market data (live rate + daily ATR) → "suggested stop & target".
  const forexMarket = createForexMarketService({ twelveDataKey: env.TWELVEDATA_API_KEY });

  // Economic calendar: Forex Factory weekly feed (free, keyless), synced on
  // read with an hourly TTL guard. Provider-agnostic — swappable later.
  const calendar = createCalendarService(createForexFactoryCalendarProvider());

  const app = Fastify({ logger: true });

  // CORS: explicit allowlist only — never wildcard with credentials.
  app.addHook("onRequest", async (req, reply) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Vary", "Origin");
      reply.header("Access-Control-Allow-Credentials", "true");
      reply.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
      reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    }
    if (req.method === "OPTIONS") reply.code(204).send();
  });

  // Consistent, safe error shape for everything thrown in handlers. The safe
  // client shape hides the real cause (e.g. an upstream SnapTrade message), so
  // log it server-side for diagnosis — errors for 5xx, warnings for 4xx.
  app.setErrorHandler((err, req, reply) => {
    const { body, status } = toApiError(err);
    if (status >= 500) {
      req.log.error({ err, code: body.code }, `Request failed (${status}): ${err.message}`);
    } else {
      req.log.warn({ code: body.code }, `Request rejected (${status}): ${err.message}`);
    }
    reply.code(status).send(body);
  });

  // Unknown routes use the same { error, code } contract.
  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: "Not found", code: "NOT_FOUND" });
  });

  // Public root — this is an API, not the web app. Return a friendly pointer so
  // a browser hitting the bare API domain doesn't just see a 404.
  app.get("/", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    return {
      data: {
        name: "InvestIQ Forex API",
        status: "ok",
        message: "This is the InvestIQ Forex API. The web app is served separately.",
        health: "/health",
      },
    };
  });

  // Public health check (no auth).
  app.get("/health", async () => ({ data: { ok: true } }));

  // Clerk webhook (public, signature-verified) — encapsulated for raw body.
  await app.register(async (instance) => {
    await webhookRoutes(instance, env.CLERK_WEBHOOK_SECRET);
  });

  // Current user. Personalized -> no-store.
  app.get("/api/v1/me", async (req, reply) => {
    const ctx = await resolveAuthContext(req, authDeps);
    reply.header("Cache-Control", "no-store");
    return { data: { userId: ctx.userId, plan: ctx.plan, role: ctx.role } };
  });

  // Admin (users, plans, feature flags, audit).
  await app.register(async (instance) => adminRoutes(instance, authDeps));

  // Forex core: settings, pairs, saved pairs, rates, trade calc, trade plans,
  // journal (+ analytics), economic calendar, market sessions.
  await app.register(async (instance) => forexRoutes(instance, { auth: authDeps, rates, calendar, market: forexMarket }));
  app.log.info(
    rates.enabled
      ? "Forex routes enabled (live exchange rates ON)"
      : "Forex routes enabled (no live rate provider — manual/entry-price rates)",
  );

  // Learning (18-lesson forex curriculum) + glossary (forex term tooltips).
  await app.register(async (instance) => learningRoutes(instance, authDeps));
  await app.register(async (instance) => glossaryRoutes(instance, authDeps));

  // Quant Lab bridge: ingest (secret-authed, from ~/quant-lab's own cron) +
  // read (Clerk-authed, the /quant tab). Ingest stays a no-op 404 until
  // QUANT_LAB_PUSH_SECRET is configured.
  await app.register(async (instance) =>
    quantLabRoutes(instance, { auth: authDeps, pushSecret: env.QUANT_LAB_PUSH_SECRET }),
  );

  // AI Advisor — non-advisory forex education tutor over the user's own data.
  const anthropicKey = env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const advisor = createAdvisorService({
      advisor: createAnthropicAdvisor({ apiKey: anthropicKey, model: env.AI_MODEL }),
    });
    await app.register(async (instance) => advisorRoutes(instance, { auth: authDeps, advisor }));
    app.log.info("AI Advisor routes enabled");
  } else {
    app.log.warn("ANTHROPIC_API_KEY not set — AI Advisor routes disabled");
  }

  const port = resolvePort(env);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`InvestIQ Forex API listening on :${port}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
