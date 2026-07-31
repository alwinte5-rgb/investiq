import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { errors } from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import {
  getQuantSnapshot,
  listBotControls,
  markControlsApplied,
  upsertBotControl,
  upsertQuantSnapshot,
} from "../services/quant-lab.js";

export interface QuantLabRouteDeps {
  auth: AuthDeps;
  /** Shared secret quant-lab's own cron must present. When unset, the ingest
   *  route 404s — the surface doesn't exist unless deliberately enabled. */
  pushSecret?: string;
}

/** Constant-time compare so the secret check can't be timing-probed. */
function secretMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Mirrors ~/quant-lab/reports/status.py's build(). Top level is checked
// closely (these four keys are the real, stable contract) but nested shapes
// are kept loose (z.record) deliberately: this is an external Python system
// evolving on its own schedule, not this app's own domain model — rejecting
// unknown top-level keys catches real protocol drift without making every
// quant-lab-side field addition a two-repo lockstep change.
const snapshotSchema = z
  .object({
    backlog: z.object({
      total: z.number(),
      by_status: z.record(z.number()),
      ideas: z.array(z.record(z.unknown())),
    }),
    gauntlet_verdicts: z.array(z.record(z.unknown())),
    recent_retests: z.array(z.record(z.unknown())),
    incubator: z.array(z.record(z.unknown())),
    // Parity with the local dashboard — all optional so an older quant-lab
    // push (missing these) still validates. Nested shapes stay loose.
    bots: z.array(z.record(z.unknown())).optional(),
    mining: z.record(z.unknown()).optional(),
    improvements: z.record(z.unknown()).optional(),
    data_health: z.record(z.unknown()).optional(),
    // Trading-command additions (2026-07): upcoming signals, live prices,
    // Alpaca paper snapshot, options program status.
    signals: z.array(z.record(z.unknown())).optional(),
    prices: z.array(z.record(z.unknown())).optional(),
    alpaca: z.record(z.unknown()).optional(),
    options: z.record(z.unknown()).optional(),
  })
  .strict();

/** Desired per-bot limits. Bounds are the real guardrail — the UI dropdown is
 * only a convenience, so every value is range-checked here. `null` clears an
 * override (bot falls back to the validated default). */
const controlPatchSchema = z
  .object({
    riskPct: z.number().min(0.0025).max(0.03).nullable().optional(),
    maxExposure: z.number().min(0.05).max(0.25).nullable().optional(),
    paperEquity: z.number().min(100).max(10_000).nullable().optional(),
    stopPct: z.number().min(0.02).max(0.15).nullable().optional(),
    takeProfit: z.boolean().nullable().optional(),
    desiredStatus: z.enum(["active", "benched"]).nullable().optional(),
  })
  .strict();

export async function quantLabRoutes(app: FastifyInstance, deps: QuantLabRouteDeps) {
  // Ingest — called by ~/quant-lab's own cron, not a browser. Bearer-secret
  // auth instead of Clerk (no user session exists for a machine caller).
  app.post("/api/v1/quant-lab/snapshot", async (req, reply) => {
    if (!deps.pushSecret) {
      reply.code(404);
      return { error: "Not found", code: "NOT_FOUND" };
    }
    if (!secretMatches(req.headers.authorization, deps.pushSecret)) {
      throw errors.unauthorized();
    }
    const body = validate(snapshotSchema, req.body);
    await upsertQuantSnapshot(body);
    reply.header("Cache-Control", "no-store");
    return { data: { stored: true } };
  });

  // Read — the trading pages. Normal Clerk auth; any signed-in user is fine
  // (this app only has one possible user now that sign-ups are closed).
  app.get("/api/v1/quant-lab/snapshot", async (req, reply) => {
    await resolveAuthContext(req, deps.auth);
    reply.header("Cache-Control", "no-store");
    const snapshot = await getQuantSnapshot();
    return { data: snapshot };
  });

  // ---- per-bot controls -------------------------------------------------
  // Railway can't reach the Mac, so control is PULL-based: the UI stores
  // desired limits here; quant-lab's sync cron pulls, applies, and confirms.

  // UI read (Clerk).
  app.get("/api/v1/quant-lab/controls", async (req, reply) => {
    await resolveAuthContext(req, deps.auth);
    reply.header("Cache-Control", "no-store");
    return { data: await listBotControls() };
  });

  // UI write (Clerk). Ranges are enforced server-side — a dropdown can't be
  // trusted to bound risk on a real account.
  app.patch("/api/v1/quant-lab/controls/:bot", async (req, reply) => {
    await resolveAuthContext(req, deps.auth);
    const { bot } = validate(
      z.object({ bot: z.string().min(1).max(120) }),
      req.params,
    );
    const patch = validate(controlPatchSchema, req.body);
    reply.header("Cache-Control", "no-store");
    return { data: await upsertBotControl(bot, patch) };
  });

  // Mac pull (bearer secret — same machine caller as the snapshot push).
  app.get("/api/v1/quant-lab/controls/pending", async (req, reply) => {
    if (!deps.pushSecret) {
      reply.code(404);
      return { error: "Not found", code: "NOT_FOUND" };
    }
    if (!secretMatches(req.headers.authorization, deps.pushSecret)) {
      throw errors.unauthorized();
    }
    reply.header("Cache-Control", "no-store");
    return { data: await listBotControls() };
  });

  // Mac confirms it applied a set of bots (bearer secret).
  app.post("/api/v1/quant-lab/controls/applied", async (req, reply) => {
    if (!deps.pushSecret) {
      reply.code(404);
      return { error: "Not found", code: "NOT_FOUND" };
    }
    if (!secretMatches(req.headers.authorization, deps.pushSecret)) {
      throw errors.unauthorized();
    }
    const { bots } = validate(
      z.object({ bots: z.array(z.string().min(1).max(120)).max(200) }),
      req.body,
    );
    reply.header("Cache-Control", "no-store");
    return { data: { applied: await markControlsApplied(bots) } };
  });
}
