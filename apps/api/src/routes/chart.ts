import type { FastifyInstance } from "fastify";
import { tickerParamSchema } from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import { getChartOverlay } from "../services/chart-intelligence.js";
import type { MarketService } from "../services/market.js";

export interface ChartRouteDeps {
  auth: AuthDeps;
  market: MarketService;
}

/**
 * Chart Intelligence route (Layer 7). Pipeline: authenticate -> validate ->
 * service. The overlay is personalized (the user's own stored risk/analysis) ->
 * no-store. Levels are read-only over stored data; the only live value is the
 * current price, used to anchor the ladder.
 */
export async function chartRoutes(app: FastifyInstance, deps: ChartRouteDeps) {
  app.get("/api/v1/symbols/:ticker/chart", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    const { ticker } = validate(tickerParamSchema, req.params);
    reply.header("Cache-Control", "no-store");
    return { data: await getChartOverlay(ctx.userId, ticker, deps.market) };
  });
}
