import type { FastifyInstance } from "fastify";
import { forexLearningSections, forexLearningLibrary, RR_BREAK_EVEN_REFERENCE } from "@investiq/shared";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";

/**
 * Learning routes. Surfaces the curated, non-advisory 18-lesson forex
 * curriculum. Pipeline: authenticate -> return shared content. The content is
 * static reference material (not user data), but it is served behind auth, so
 * we keep it no-store for a single, consistent caching policy.
 */
export async function learningRoutes(app: FastifyInstance, auth: AuthDeps) {
  // Full curriculum for the Learn hub (ordered sections covering every lesson).
  app.get("/api/v1/learning", async (req, reply) => {
    await resolveAuthContext(req, auth);
    reply.header("Cache-Control", "no-store");
    return { data: forexLearningSections() };
  });

  // Flat lesson library (search/index) + the break-even reference table.
  app.get("/api/v1/learning/library", async (req, reply) => {
    await resolveAuthContext(req, auth);
    reply.header("Cache-Control", "no-store");
    return { data: { lessons: forexLearningLibrary(), rrBreakEvenReference: RR_BREAK_EVEN_REFERENCE } };
  });
}
