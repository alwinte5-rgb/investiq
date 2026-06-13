import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  RECOMMENDATION_TYPES,
  learningForRecommendation,
  learningForRisk,
  learningSections,
} from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";

const recTypeParamSchema = z.object({ recType: z.enum(RECOMMENDATION_TYPES) }).strict();

/**
 * Learning System routes (Layer 10). Surfaces the curated, non-advisory
 * educational content linked to each recommendation type and to risk
 * assessments. Pipeline: authenticate -> validate -> return shared mapping. The
 * content is static reference material (not user data), but it is served behind
 * auth, so we keep it no-store for a single, consistent caching policy.
 */
export async function learningRoutes(app: FastifyInstance, auth: AuthDeps) {
  // Full curriculum for the Learn hub (ordered sections covering every explainer).
  app.get("/api/v1/learning", async (req, reply) => {
    await resolveAuthContext(req, auth);
    reply.header("Cache-Control", "no-store");
    return { data: learningSections() };
  });

  app.get("/api/v1/learning/recommendation/:recType", async (req, reply) => {
    await resolveAuthContext(req, auth);
    const { recType } = validate(recTypeParamSchema, req.params);
    reply.header("Cache-Control", "no-store");
    return { data: learningForRecommendation(recType) };
  });

  app.get("/api/v1/learning/risk", async (req, reply) => {
    await resolveAuthContext(req, auth);
    reply.header("Cache-Control", "no-store");
    return { data: learningForRisk() };
  });
}
