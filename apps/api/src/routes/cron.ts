import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { errors } from "@investiq/shared";
import type { AnalysisDeps } from "../services/analysis.js";
import { scanMarket } from "../services/market-scan.js";

export interface CronRouteDeps {
  /** Shared secret a scheduled caller must present. When unset, routes 404 (disabled). */
  secret?: string;
  /** AI deps for the scan. Null when no Anthropic key is configured. */
  analysis: AnalysisDeps | null;
}

/** Constant-time compare so the secret check can't be timing-probed. */
function secretMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Cron routes — invoked by a scheduled caller (e.g. a Railway cron job), NOT by
 * end users. Authenticated with a static `Bearer <CRON_SECRET>` header rather
 * than Clerk, since there is no user session. Disabled (404) when no secret is
 * configured, so the surface doesn't exist unless deliberately enabled.
 */
export async function cronRoutes(app: FastifyInstance, deps: CronRouteDeps) {
  // Daily market opportunity scan. Returns 202 immediately and runs in the
  // background — a full universe scan far exceeds typical HTTP timeouts.
  app.post("/api/v1/cron/scan-market", async (req, reply) => {
    if (!deps.secret) {
      reply.code(404);
      return { error: "Not found", code: "NOT_FOUND" };
    }
    if (!secretMatches(req.headers.authorization, deps.secret)) {
      throw errors.unauthorized();
    }
    reply.header("Cache-Control", "no-store");
    if (!deps.analysis) {
      reply.code(503);
      return { error: "AI analysis is not configured", code: "AI_DISABLED" };
    }
    const analysisDeps = deps.analysis;
    void scanMarket(analysisDeps, (m, e) =>
      e ? req.log.warn({ err: e }, m) : req.log.info(m),
    );
    reply.code(202);
    return { data: { started: true } };
  });
}
