import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { cuidSchema, errors, type Plan } from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import {
  disconnect,
  getAccounts,
  getPortfolioSummary,
  listConnections,
  startConnection,
  syncConnection,
  type BrokerageDeps,
} from "../services/brokerage.js";
import { enableDemoPortfolio } from "../services/demo-portfolio.js";

const idParam = z.object({ id: cuidSchema }).strict();

export interface ConnectionRouteDeps {
  auth: AuthDeps;
  /**
   * SnapTrade deps. Optional: when absent, the connect/sync endpoints report a
   * clear "not configured" error, but demo + dashboard reads still work — sample
   * data must never depend on brokerage credentials being set.
   */
  brokerage?: BrokerageDeps;
  /** Fire-and-forget hook run after sample data is seeded (real-AI warm-up). */
  onDemoEnabled?: (userId: string, plan: Plan) => void;
}

/**
 * Brokerage + portfolio routes. All personalized -> no-store. Object-level
 * ownership enforced in the service layer. The demo + read endpoints are always
 * available; only connect/sync require SnapTrade credentials.
 */
export async function connectionRoutes(app: FastifyInstance, deps: ConnectionRouteDeps) {
  function requireBrokerage(): BrokerageDeps {
    if (!deps.brokerage) {
      throw errors.validation("Brokerage connection isn’t configured. Explore with sample data instead.");
    }
    return deps.brokerage;
  }

  // Start/resume a connection -> returns the SnapTrade portal URL to open.
  app.post("/api/v1/connections", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    reply.header("Cache-Control", "no-store");
    reply.code(201);
    return { data: await startConnection(requireBrokerage(), ctx.userId) };
  });

  // Seed a read-only sample-data portfolio so users can explore before
  // connecting a real brokerage. Not plan-gated (like a real connection) —
  // the Intelligence/Reviews layers stay gated on top of it.
  app.post("/api/v1/connections/demo", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    reply.header("Cache-Control", "no-store");
    reply.code(201);
    const result = await enableDemoPortfolio(ctx.userId);
    // Kick off real grounded analyses for the sample holdings (fire-and-forget).
    deps.onDemoEnabled?.(ctx.userId, ctx.plan);
    return { data: result };
  });

  app.get("/api/v1/connections", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    reply.header("Cache-Control", "no-store");
    return { data: await listConnections(ctx.userId) };
  });

  // Sync holdings/transactions for a specific connection (or the user's only one).
  app.post("/api/v1/connections/:id/sync", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    const { id } = validate(idParam, req.params);
    reply.header("Cache-Control", "no-store");
    return { data: await syncConnection(requireBrokerage(), ctx.userId, id) };
  });

  app.delete("/api/v1/connections/:id", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    const { id } = validate(idParam, req.params);
    await disconnect(requireBrokerage(), ctx.userId, id);
    reply.header("Cache-Control", "no-store");
    return { data: { deleted: true } };
  });

  app.get("/api/v1/accounts", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    reply.header("Cache-Control", "no-store");
    return { data: await getAccounts(ctx.userId) };
  });

  app.get("/api/v1/portfolio/summary", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    reply.header("Cache-Control", "no-store");
    return { data: await getPortfolioSummary(ctx.userId) };
  });
}
