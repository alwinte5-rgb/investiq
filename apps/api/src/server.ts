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
import { symbolRoutes } from "./routes/symbols.js";
import { watchlistRoutes } from "./routes/watchlists.js";
import { marketRoutes } from "./routes/market.js";
import { connectionRoutes } from "./routes/connections.js";
import { adminRoutes } from "./routes/admin.js";
import { analysisRoutes } from "./routes/analysis.js";
import { portfolioRoutes } from "./routes/portfolio.js";
import { reviewRoutes } from "./routes/reviews.js";
import { riskRoutes } from "./routes/risk.js";
import { chartRoutes } from "./routes/chart.js";
import { opportunityRoutes } from "./routes/opportunities.js";
import { paperRoutes } from "./routes/paper.js";
import { learningRoutes } from "./routes/learning.js";
import { glossaryRoutes } from "./routes/glossary.js";
import { discoveryRoutes } from "./routes/discovery.js";
import { newsRoutes } from "./routes/news.js";
import { createMarketService } from "./services/market.js";
import { createNewsService } from "./services/news.js";
import { createFundamentalsService } from "./services/fundamentals.js";
import { createDiscoveryService } from "./services/discovery.js";
import { createSnapTradeClient } from "@investiq/integrations";
import { createAnthropicAnalysisModel, createAnthropicNewsClassifier } from "@investiq/ai";
import type { BrokerageDeps } from "./services/brokerage.js";
import { warmUpDemoAnalyses } from "./services/demo-warmup.js";
import type { Plan } from "@investiq/shared";

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
  const market = createMarketService({
    twelveDataKey: env.TWELVEDATA_API_KEY,
    massiveKey: env.MASSIVE_API_KEY,
    massiveBaseUrl: env.MASSIVE_BASE_URL,
    onFailover: (err) => app.log.warn({ err }, "twelvedata failover -> massive"),
  });
  const news = createNewsService({
    benzingaKey: env.BENZINGA_API_KEY,
    marketauxKey: env.MARKETAUX_API_KEY,
  });
  const fundamentals = createFundamentalsService({ fmpKey: env.FMP_API_KEY });
  const discovery = createDiscoveryService({ fmpKey: env.FMP_API_KEY });

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
        name: "InvestIQ API",
        status: "ok",
        message: "This is the InvestIQ API. The web app is served separately.",
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

  // Layer 1 feature routes.
  await app.register(async (instance) => symbolRoutes(instance, authDeps));
  await app.register(async (instance) => watchlistRoutes(instance, authDeps));
  await app.register(async (instance) => marketRoutes(instance, { auth: authDeps, market, news }));
  await app.register(async (instance) => adminRoutes(instance, authDeps));
  await app.register(async (instance) => portfolioRoutes(instance, authDeps));
  await app.register(async (instance) => reviewRoutes(instance, authDeps));
  // Risk Engine (Layer 6) — deterministic, needs only market + fundamentals.
  await app.register(async (instance) => riskRoutes(instance, { auth: authDeps, risk: { market, fundamentals } }));
  // Chart Intelligence (Layer 7) — projection of stored risk/analysis + live price anchor.
  await app.register(async (instance) => chartRoutes(instance, { auth: authDeps, market }));
  // Opportunity Engine (Layer 8) — Investor+ gated in-service; derives from L2–L6.
  await app.register(async (instance) => opportunityRoutes(instance, authDeps));
  // Paper Trading (Layer 9) — self-contained simulator; fills at live quotes.
  await app.register(async (instance) => paperRoutes(instance, { auth: authDeps, paper: { market } }));
  // Learning System (Layer 10) — curated non-advisory education linked to each recommendation/risk.
  await app.register(async (instance) => learningRoutes(instance, authDeps));
  // Glossary — plain-English term library powering inline tooltips (web + mobile).
  await app.register(async (instance) => glossaryRoutes(instance, authDeps));
  // Discovery — screened "ideas to research" (FMP screener); factual, not AI signals.
  await app.register(async (instance) => discoveryRoutes(instance, { auth: authDeps, discovery }));

  // AI analysis deps are built up-front so BOTH the demo warm-up and the
  // analysis routes can share one model instance.
  const anthropicKey = env.ANTHROPIC_API_KEY;
  const model = anthropicKey
    ? createAnthropicAnalysisModel({ apiKey: anthropicKey, model: env.AI_MODEL })
    : null;
  const analysisDeps = model ? { market, news, fundamentals, model } : null;

  // After sample data is seeded, generate REAL grounded analyses for the demo
  // holdings so the AI screens (Research/Risk/Opportunities) populate. Best-
  // effort, fire-and-forget; only available when the AI model is configured.
  const onDemoEnabled = analysisDeps
    ? (userId: string, plan: Plan) => {
        void warmUpDemoAnalyses(
          userId,
          plan,
          { analysis: analysisDeps, risk: { market, fundamentals } },
          (m, e) => app.log.warn({ err: e }, m),
        );
      }
    : undefined;

  // Brokerage (SnapTrade) is OPTIONAL — connect/sync need credentials, but the
  // demo + dashboard reads must always work, so connectionRoutes always registers.
  const brokerage: BrokerageDeps | undefined =
    env.SNAPTRADE_CLIENT_ID && env.SNAPTRADE_CONSUMER_KEY && env.CONNECTION_ENCRYPTION_KEY
      ? {
          client: createSnapTradeClient(env.SNAPTRADE_CLIENT_ID, env.SNAPTRADE_CONSUMER_KEY),
          encKey: env.CONNECTION_ENCRYPTION_KEY,
          redirectUri: env.SNAPTRADE_REDIRECT_URI,
        }
      : undefined;
  await app.register(async (instance) =>
    connectionRoutes(instance, { auth: authDeps, brokerage, onDemoEnabled }),
  );
  app.log.info(
    brokerage
      ? "SnapTrade brokerage routes enabled"
      : "SnapTrade not configured — connect/sync disabled (demo + dashboard still available)",
  );

  // AI analysis (Layer 2) — only enabled when an Anthropic key is set.
  if (analysisDeps) {
    await app.register(async (instance) => analysisRoutes(instance, { auth: authDeps, analysis: analysisDeps }));
    app.log.info(
      `AI analysis routes enabled (model=${env.AI_MODEL}, fundamentals=${fundamentals.enabled})`,
    );

    // Layer 5 — News Intelligence (needs the AI key + at least one news provider).
    if (anthropicKey && news.enabled) {
      const classifier = createAnthropicNewsClassifier({ apiKey: anthropicKey, model: env.AI_MODEL });
      await app.register(async (instance) =>
        newsRoutes(instance, { auth: authDeps, newsIntel: { news, classifier } }),
      );
      app.log.info("News Intelligence routes enabled");
    } else {
      app.log.warn("News providers not configured — News Intelligence routes disabled");
    }
  } else {
    app.log.warn("ANTHROPIC_API_KEY not set — AI analysis routes disabled");
  }

  const port = resolvePort(env);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`InvestIQ API listening on :${port}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
