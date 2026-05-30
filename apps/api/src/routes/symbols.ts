import type { FastifyInstance } from "fastify";
import { symbolSearchSchema } from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import { searchSymbols } from "../services/symbols.js";

/**
 * Symbol routes. Handlers stay thin: auth -> validate -> service -> response.
 * Results are non-personalized; no per-user no-store required.
 */
export async function symbolRoutes(app: FastifyInstance, deps: AuthDeps) {
  app.get("/api/v1/symbols/search", async (req) => {
    await resolveAuthContext(req, deps); // authn (search is gated)
    const { q } = validate(symbolSearchSchema, req.query);
    const results = await searchSymbols(q);
    return { data: results };
  });
}
