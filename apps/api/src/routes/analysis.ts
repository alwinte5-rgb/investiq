import type { FastifyInstance } from "fastify";
import { generateAnalysisSchema, tickerParamSchema } from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import { generateAnalysis, getLatestAnalysis, type AnalysisDeps } from "../services/analysis.js";

export interface AnalysisRouteDeps {
  auth: AuthDeps;
  analysis: AnalysisDeps;
}

/**
 * AI analysis routes. Pipeline per handler: authenticate -> validate -> service.
 * All responses are personalized (per-user analyses) -> no-store. Quota is
 * enforced server-side inside the service, before any model call.
 */
export async function analysisRoutes(app: FastifyInstance, deps: AnalysisRouteDeps) {
  // Generate (or reuse) an analysis for a symbol.
  app.post("/api/v1/analysis", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    const { ticker } = validate(generateAnalysisSchema, req.body);
    reply.header("Cache-Control", "no-store");
    const result = await generateAnalysis(ctx.userId, ctx.plan, ticker, deps.analysis);
    return { data: result };
  });

  // Latest stored analysis for a symbol (no generation, no quota use).
  app.get("/api/v1/symbols/:ticker/analysis", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    const { ticker } = validate(tickerParamSchema, req.params);
    reply.header("Cache-Control", "no-store");
    return { data: await getLatestAnalysis(ctx.userId, ticker) };
  });
}
