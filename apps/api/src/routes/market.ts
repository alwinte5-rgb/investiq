import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { tickerSchema } from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import type { MarketService } from "../services/market.js";
import type { NewsService } from "../services/news.js";

const tickerParam = z.object({ ticker: tickerSchema }).strict();
const newsQuery = z.object({ symbol: tickerSchema.optional() }).strict();

export interface MarketRouteDeps {
  auth: AuthDeps;
  market: MarketService;
  news: NewsService;
}

/**
 * Market + news routes. Auth-gated but non-personalized (data is shared across
 * users and served from a short-TTL cache in the service layer).
 */
export async function marketRoutes(app: FastifyInstance, deps: MarketRouteDeps) {
  app.get("/api/v1/symbols/:ticker/quote", async (req) => {
    await resolveAuthContext(req, deps.auth);
    const { ticker } = validate(tickerParam, req.params);
    return { data: await deps.market.getQuote(ticker) };
  });

  app.get("/api/v1/market/overview", async (req) => {
    await resolveAuthContext(req, deps.auth);
    return { data: await deps.market.getOverview() };
  });

  app.get("/api/v1/market/movers", async (req) => {
    await resolveAuthContext(req, deps.auth);
    return { data: await deps.market.getMovers() };
  });

  app.get("/api/v1/news", async (req) => {
    await resolveAuthContext(req, deps.auth);
    const { symbol } = validate(newsQuery, req.query);
    return { data: await deps.news.getNews(symbol) };
  });
}
