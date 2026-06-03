import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { cuidSchema } from "@investiq/shared";
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
  brokerage: BrokerageDeps;
}

/**
 * Brokerage (SnapTrade) routes. All personalized -> no-store. Object-level
 * ownership enforced in the service layer.
 */
export async function connectionRoutes(app: FastifyInstance, deps: ConnectionRouteDeps) {
  // Start/resume a connection -> returns the SnapTrade portal URL to open.
  app.post("/api/v1/connections", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    reply.header("Cache-Control", "no-store");
    reply.code(201);
    return { data: await startConnection(deps.brokerage, ctx.userId) };
  });

  // Seed a read-only sample-data portfolio so users can explore before
  // connecting a real brokerage. Not plan-gated (like a real connection) —
  // the Intelligence/Reviews layers stay gated on top of it.
  app.post("/api/v1/connections/demo", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    reply.header("Cache-Control", "no-store");
    reply.code(201);
    return { data: await enableDemoPortfolio(ctx.userId) };
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
    return { data: await syncConnection(deps.brokerage, ctx.userId, id) };
  });

  app.delete("/api/v1/connections/:id", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    const { id } = validate(idParam, req.params);
    await disconnect(deps.brokerage, ctx.userId, id);
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
