import Fastify from "fastify";
import { loadServerEnv, parseAllowedOrigins, toApiError, errors } from "@investiq/shared";
import { findOrProvisionUser } from "@investiq/db";
import { authenticate } from "./lib/auth.js";
import { makeClerkVerifier, makeClerkClient, userLoader } from "./lib/context.js";
import { webhookRoutes } from "./routes/webhooks.js";

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

  // Clerk webhook (public, signature-verified) — encapsulated for raw body.
  await app.register(async (instance) => {
    await webhookRoutes(instance, env.CLERK_WEBHOOK_SECRET);
  });

  // Example protected route demonstrating the pipeline. Personalized -> no-store.
  app.get("/api/v1/me", async (req, reply) => {
    let ctx;
    try {
      ctx = await authenticate(req.headers.authorization, clerkVerifier, userLoader);
    } catch (err) {
      // Lazy provision: token valid but User row not yet created by webhook.
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
      const verified = await clerkVerifier.verify(token);
      if (!verified) throw err;
      const cu = await clerk.users.getUser(verified.clerkId);
      const email = cu.primaryEmailAddress?.emailAddress ?? cu.emailAddresses[0]?.emailAddress;
      if (!email) throw errors.unauthorized("No email on account");
      const user = await findOrProvisionUser({
        clerkId: verified.clerkId,
        email,
        name: [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null,
        avatarUrl: cu.imageUrl ?? null,
      });
      ctx = { userId: user.id, clerkId: user.clerkId, plan: user.plan, role: user.role };
    }
    reply.header("Cache-Control", "no-store");
    return { data: { userId: ctx.userId, plan: ctx.plan, role: ctx.role } };
  });

  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  app.log.info(`InvestIQ API listening on :${env.API_PORT}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
