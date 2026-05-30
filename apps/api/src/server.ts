import Fastify from "fastify";
import { loadServerEnv, parseAllowedOrigins, toApiError } from "@investiq/shared";
import { authenticate } from "./lib/auth.js";
import { clerkVerifier, userLoader } from "./lib/context.js";

/**
 * InvestIQ API. Boots with FAIL-FAST env validation. Every protected route
 * follows: authenticate -> authorize -> validate -> business logic -> response.
 */
async function main() {
  // STARTUP: validate env; missing/invalid vars crash the process immediately.
  const env = loadServerEnv();
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);

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

  // Public health check (no auth).
  app.get("/health", async () => ({ data: { ok: true } }));

  // Example protected route demonstrating the pipeline.
  // Personalized -> never cached.
  app.get("/api/v1/me", async (req, reply) => {
    const ctx = await authenticate(req.headers.authorization, clerkVerifier, userLoader);
    reply.header("Cache-Control", "no-store");
    return { data: { userId: ctx.userId, plan: ctx.plan, role: ctx.role } };
  });

  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  app.log.info(`InvestIQ API listening on :${env.API_PORT}`);
}

main().catch((err) => {
  // Boot failure (e.g. missing env) — print readable reason and exit non-zero.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
