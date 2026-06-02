import type { FastifyInstance } from "fastify";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import {
  generatePortfolioAnalysis,
  getLatestPortfolioAnalysis,
} from "../services/portfolio.js";

/**
 * Portfolio Intelligence routes (Layer 3). Investor+ only — entitlement is
 * enforced server-side inside the service. Personalized -> no-store.
 */
export async function portfolioRoutes(app: FastifyInstance, deps: AuthDeps) {
  // Generate a fresh portfolio analysis from current holdings.
  app.post("/api/v1/portfolio/analysis", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps);
    reply.header("Cache-Control", "no-store");
    return { data: await generatePortfolioAnalysis(ctx.userId, ctx.plan) };
  });

  // Latest stored portfolio analysis (no recompute).
  app.get("/api/v1/portfolio/analysis", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps);
    reply.header("Cache-Control", "no-store");
    return { data: await getLatestPortfolioAnalysis(ctx.userId, ctx.plan) };
  });
}
