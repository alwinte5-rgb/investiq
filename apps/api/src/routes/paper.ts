import type { FastifyInstance } from "fastify";
import { paperOrderSchema } from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import {
  getEquityCurve,
  getPaperAccount,
  listOrders,
  submitOrder,
  type PaperDeps,
} from "../services/paper.js";

export interface PaperRouteDeps {
  auth: AuthDeps;
  paper: PaperDeps;
}

/**
 * Paper trading routes (Layer 9). Pipeline per handler: authenticate -> validate
 * -> service (own-account authorization is implicit — the account is resolved
 * from the authenticated user). Personalized -> no-store. Simulated only.
 */
export async function paperRoutes(app: FastifyInstance, deps: PaperRouteDeps) {
  app.get("/api/v1/paper/account", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    reply.header("Cache-Control", "no-store");
    return { data: await getPaperAccount(ctx.userId, deps.paper) };
  });

  app.post("/api/v1/paper/orders", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    const input = validate(paperOrderSchema, req.body);
    reply.header("Cache-Control", "no-store");
    return { data: await submitOrder(ctx.userId, input, deps.paper) };
  });

  app.get("/api/v1/paper/orders", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    reply.header("Cache-Control", "no-store");
    return { data: await listOrders(ctx.userId) };
  });

  app.get("/api/v1/paper/performance", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    reply.header("Cache-Control", "no-store");
    return { data: await getEquityCurve(ctx.userId) };
  });
}
