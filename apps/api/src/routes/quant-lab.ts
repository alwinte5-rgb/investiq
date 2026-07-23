import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { errors } from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import { getQuantSnapshot, upsertQuantSnapshot } from "../services/quant-lab.js";

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

  // Read — the /quant tab. Normal Clerk auth; any signed-in user is fine
  // (this app only has one possible user now that sign-ups are closed).
  app.get("/api/v1/quant-lab/snapshot", async (req, reply) => {
    await resolveAuthContext(req, deps.auth);
    reply.header("Cache-Control", "no-store");
    const snapshot = await getQuantSnapshot();
    return { data: snapshot };
  });
}
