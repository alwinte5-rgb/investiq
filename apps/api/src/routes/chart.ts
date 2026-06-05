import type { FastifyInstance } from "fastify";
import { tickerParamSchema } from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import { getChartOverlay } from "../services/chart-intelligence.js";

/**
 * Chart Intelligence route (Layer 7). Pipeline: authenticate -> validate ->
 * service. The overlay is personalized (the user's own stored risk/analysis) ->
 * no-store. Read-only: no live market or model calls.
 */
export async function chartRoutes(app: FastifyInstance, auth: AuthDeps) {
  app.get("/api/v1/symbols/:ticker/chart", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    const { ticker } = validate(tickerParamSchema, req.params);
    reply.header("Cache-Control", "no-store");
    return { data: await getChartOverlay(ctx.userId, ticker) };
  });
}
