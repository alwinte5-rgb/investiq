import type { FastifyInstance } from "fastify";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import type { DiscoveryService } from "../services/discovery.js";

export interface DiscoveryRouteDeps {
  auth: AuthDeps;
  discovery: DiscoveryService;
}

/**
 * Discovery route — screened "ideas to research" (FMP company screener). Auth-
 * gated but NON-personalized (the same screens for everyone), served from the
 * service's shared TTL cache. Not AI recommendations: factual screen results.
 */
export async function discoveryRoutes(app: FastifyInstance, deps: DiscoveryRouteDeps) {
  app.get("/api/v1/discovery", async (req) => {
    await resolveAuthContext(req, deps.auth);
    return { data: await deps.discovery.getDiscovery() };
  });
}
