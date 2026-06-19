import type { FastifyInstance } from "fastify";
import { tickerParamSchema } from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import type { FilingsService } from "../services/filings.js";

export interface FilingsRouteDeps {
  auth: AuthDeps;
  filings: FilingsService;
}

/**
 * Filings route (SEC EDGAR) — latest 10-K/10-Q links for a ticker. Educational
 * primary-source material; non-personalized. Pipeline: authenticate -> validate
 * -> service. Returns null `data` when EDGAR doesn't list the ticker as a filer.
 */
export async function filingsRoutes(app: FastifyInstance, deps: FilingsRouteDeps) {
  app.get("/api/v1/filings/:ticker", async (req, reply) => {
    await resolveAuthContext(req, deps.auth);
    const { ticker } = validate(tickerParamSchema, req.params);
    reply.header("Cache-Control", "no-store");
    return { data: await deps.filings.getFilings(ticker) };
  });
}
