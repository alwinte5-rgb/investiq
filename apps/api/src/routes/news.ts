import type { FastifyInstance } from "fastify";
import { tickerParamSchema } from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import {
  getSymbolNewsWithImpact,
  ingestAndClassify,
  type NewsIntelligenceDeps,
} from "../services/news-intelligence.js";

export interface NewsRouteDeps {
  auth: AuthDeps;
  newsIntel: NewsIntelligenceDeps;
}

/**
 * Layer 5 — News Intelligence routes. Investor+ only (entitlement enforced
 * server-side in the service). Personalized auth -> no-store.
 */
export async function newsRoutes(app: FastifyInstance, deps: NewsRouteDeps) {
  // Stored articles + impact classifications for a symbol.
  app.get("/api/v1/symbols/:ticker/news", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    const { ticker } = validate(tickerParamSchema, req.params);
    reply.header("Cache-Control", "no-store");
    return { data: await getSymbolNewsWithImpact(ticker, ctx.plan) };
  });

  // Ingest latest news for a symbol and classify new items (grounded AI).
  app.post("/api/v1/symbols/:ticker/news/refresh", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    const { ticker } = validate(tickerParamSchema, req.params);
    reply.header("Cache-Control", "no-store");
    return { data: await ingestAndClassify(ticker, ctx.plan, deps.newsIntel) };
  });
}
