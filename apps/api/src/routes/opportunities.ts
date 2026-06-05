import type { FastifyInstance } from "fastify";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import { generateOpportunities, getOpportunities } from "../services/opportunities.js";

/**
 * Opportunity Engine routes (Layer 8). Pipeline: authenticate -> (entitlement
 * gate in service) -> service. Personalized + Investor+ gated -> no-store.
 * Read-only over stored L2–L6 data; no live market or model calls.
 */
export async function opportunityRoutes(app: FastifyInstance, auth: AuthDeps) {
  // Latest stored opportunity set, grouped + ranked.
  app.get("/api/v1/opportunities", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    reply.header("Cache-Control", "no-store");
    return { data: await getOpportunities(ctx.userId, ctx.plan) };
  });

  // Regenerate the opportunity set from the user's stored analyses + context.
  app.post("/api/v1/opportunities", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    reply.header("Cache-Control", "no-store");
    return { data: await generateOpportunities(ctx.userId, ctx.plan) };
  });
}
