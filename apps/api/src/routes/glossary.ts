import type { FastifyInstance } from "fastify";
import { forexGlossaryTerms } from "@investiq/shared";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";

/**
 * Glossary route. Serves the curated, plain-English FOREX term library that
 * powers inline tooltips on web + mobile. Pipeline: authenticate -> return
 * shared library. The content is static reference material (not user data),
 * but it is served behind auth, so we keep it no-store for one consistent
 * caching policy — the same approach as the Learning routes.
 */
export async function glossaryRoutes(app: FastifyInstance, auth: AuthDeps) {
  app.get("/api/v1/glossary", async (req, reply) => {
    await resolveAuthContext(req, auth);
    reply.header("Cache-Control", "no-store");
    return { data: forexGlossaryTerms() };
  });
}
