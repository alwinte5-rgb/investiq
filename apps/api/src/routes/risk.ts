import type { FastifyInstance } from "fastify";
import { tickerParamSchema } from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import {
  assessPortfolioRisk,
  assessSymbolRisk,
  getLatestSymbolRisk,
  type RiskDeps,
} from "../services/risk.js";

export interface RiskRouteDeps {
  auth: AuthDeps;
  risk: RiskDeps;
}

/**
 * Risk Engine routes (Layer 6). Pipeline per handler: authenticate -> validate
 * -> service. Personalized (per-user assessments) -> no-store.
 */
export async function riskRoutes(app: FastifyInstance, deps: RiskRouteDeps) {
  // Compute (and store) a risk assessment for a symbol.
  app.post("/api/v1/symbols/:ticker/risk", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    const { ticker } = validate(tickerParamSchema, req.params);
    reply.header("Cache-Control", "no-store");
    return { data: await assessSymbolRisk(ctx.userId, ticker, deps.risk) };
  });

  // Latest stored risk assessment for a symbol (no recompute).
  app.get("/api/v1/symbols/:ticker/risk", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    const { ticker } = validate(tickerParamSchema, req.params);
    reply.header("Cache-Control", "no-store");
    return { data: await getLatestSymbolRisk(ctx.userId, ticker) };
  });

  // Portfolio-level risk roll-up (per-holding warning colors + overall).
  app.get("/api/v1/portfolio/risk", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    reply.header("Cache-Control", "no-store");
    return { data: await assessPortfolioRisk(ctx.userId) };
  });
}
