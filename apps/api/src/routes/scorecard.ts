import type { FastifyInstance } from "fastify";
import { financialStrengthScore, tickerParamSchema } from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import type { FundamentalsService } from "../services/fundamentals.js";

export interface ScorecardRouteDeps {
  auth: AuthDeps;
  fundamentals: FundamentalsService;
}

/**
 * Scorecard route — deterministic, factual at-a-glance numbers for a ticker
 * (financial strength + the key fundamentals behind it). No AI, nothing
 * fabricated: every field is null when the data isn't available. Educational.
 */
export async function scorecardRoutes(app: FastifyInstance, deps: ScorecardRouteDeps) {
  app.get("/api/v1/symbols/:ticker/scorecard", async (req, reply) => {
    await resolveAuthContext(req, deps.auth);
    const { ticker } = validate(tickerParamSchema, req.params);
    reply.header("Cache-Control", "no-store");

    const f = await deps.fundamentals.getFundamentals(ticker).catch(() => null);
    return {
      data: {
        ticker: ticker.toUpperCase(),
        financialStrength: f ? financialStrengthScore(f) : null,
        marketCap: f?.marketCap ?? null,
        pe: f?.pe ?? null,
        roe: f?.roe ?? null,
        netMargin: f?.netMargin ?? null,
        debtToEquity: f?.debtToEquity ?? null,
      },
    };
  });
}
