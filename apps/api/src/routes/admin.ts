import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { cuidSchema, PLANS } from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { requireAdmin } from "../lib/auth.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import {
  adminOverview,
  listApiHealth,
  listAuditLogs,
  listFlags,
  listUsers,
  updateUser,
  upsertFlag,
} from "../services/admin.js";

const userPatch = z
  .object({ plan: z.enum(PLANS).optional(), role: z.enum(["USER", "ADMIN"]).optional() })
  .strict()
  .refine((p) => p.plan || p.role, { message: "Nothing to update" });

const flagPatch = z
  .object({ enabled: z.boolean(), rolloutPct: z.number().int().min(0).max(100).optional() })
  .strict();

/** Resolve the caller and require ADMIN — the gate for every admin route. */
async function admin(req: Parameters<typeof resolveAuthContext>[0], deps: AuthDeps) {
  const ctx = await resolveAuthContext(req, deps);
  requireAdmin(ctx);
  return ctx;
}

export async function adminRoutes(app: FastifyInstance, deps: AuthDeps) {
  app.get("/api/v1/admin/overview", async (req, reply) => {
    await admin(req, deps);
    reply.header("Cache-Control", "no-store");
    return { data: await adminOverview() };
  });

  app.get("/api/v1/admin/users", async (req, reply) => {
    await admin(req, deps);
    reply.header("Cache-Control", "no-store");
    return { data: await listUsers() };
  });

  app.patch("/api/v1/admin/users/:id", async (req, reply) => {
    const ctx = await admin(req, deps);
    const { id } = validate(z.object({ id: cuidSchema }).strict(), req.params);
    const patch = validate(userPatch, req.body);
    reply.header("Cache-Control", "no-store");
    return { data: await updateUser(ctx.userId, id, patch) };
  });

  app.get("/api/v1/admin/flags", async (req, reply) => {
    await admin(req, deps);
    reply.header("Cache-Control", "no-store");
    return { data: await listFlags() };
  });

  app.put("/api/v1/admin/flags/:key", async (req, reply) => {
    const ctx = await admin(req, deps);
    const { key } = validate(z.object({ key: z.string().trim().min(1).max(60) }).strict(), req.params);
    const patch = validate(flagPatch, req.body);
    reply.header("Cache-Control", "no-store");
    return { data: await upsertFlag(ctx.userId, key, patch) };
  });

  app.get("/api/v1/admin/audit", async (req, reply) => {
    await admin(req, deps);
    reply.header("Cache-Control", "no-store");
    return { data: await listAuditLogs() };
  });

  app.get("/api/v1/admin/api-health", async (req, reply) => {
    await admin(req, deps);
    reply.header("Cache-Control", "no-store");
    return { data: await listApiHealth() };
  });
}
