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
import { createMarketService } from "./services/market.js";
import { createNewsService } from "./services/news.js";
import { createSnapTradeClient } from "@investiq/integrations";
import type { BrokerageDeps } from "./services/brokerage.js";

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

  // Consistent, safe error shape for everything thrown in handlers.
  app.setErrorHandler((err, _req, reply) => {
    const { body, status } = toApiError(err);
    reply.code(status).send(body);
  });

  // Unknown routes use the same { error, code } contract.
  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: "Not found", code: "NOT_FOUND" });
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

  // Brokerage (SnapTrade) — only enabled when credentials + encryption key are set.
  if (env.SNAPTRADE_CLIENT_ID && env.SNAPTRADE_CONSUMER_KEY && env.CONNECTION_ENCRYPTION_KEY) {
    const brokerage: BrokerageDeps = {
      client: createSnapTradeClient(env.SNAPTRADE_CLIENT_ID, env.SNAPTRADE_CONSUMER_KEY),
      encKey: env.CONNECTION_ENCRYPTION_KEY,
    };
    await app.register(async (instance) => connectionRoutes(instance, { auth: authDeps, brokerage }));
    app.log.info("SnapTrade brokerage routes enabled");
  } else {
    app.log.warn("SnapTrade not configured — brokerage routes disabled");
  }

  const port = resolvePort(env);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`InvestIQ API listening on :${port}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
