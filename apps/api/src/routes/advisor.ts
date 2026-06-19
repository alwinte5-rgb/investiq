import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import type { AdvisorService } from "../services/advisor.js";

export interface AdvisorRouteDeps {
  auth: AuthDeps;
  advisor: AdvisorService;
}

const askSchema = z.object({ question: z.string().trim().min(3).max(500) }).strict();

/**
 * AI Advisor route. Pipeline: authenticate -> validate -> service. Personalized
 * (uses the caller's own data as context) -> no-store. The service enforces the
 * non-advisory guardrail before returning.
 */
export async function advisorRoutes(app: FastifyInstance, deps: AdvisorRouteDeps) {
  app.post("/api/v1/advisor", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    const { question } = validate(askSchema, req.body);
    reply.header("Cache-Control", "no-store");
    return { data: await deps.advisor.ask(ctx.userId, question) };
  });
}
