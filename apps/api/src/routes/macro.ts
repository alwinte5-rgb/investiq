import type { FastifyInstance } from "fastify";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import type { MacroService } from "../services/macro.js";

export interface MacroRouteDeps {
  auth: AuthDeps;
  macro: MacroService;
}

/**
 * Macro route — educational, non-personalized macro indicators (FRED) for the
 * Learn hub. Auth-gated but the same for everyone; served from the service's
 * shared 12h cache.
 */
export async function macroRoutes(app: FastifyInstance, deps: MacroRouteDeps) {
  app.get("/api/v1/macro", async (req, reply) => {
    await resolveAuthContext(req, deps.auth);
    reply.header("Cache-Control", "no-store");
    return { data: await deps.macro.getMacro() };
  });
}
