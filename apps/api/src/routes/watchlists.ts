import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  addWatchlistItemSchema,
  createWatchlistSchema,
  cuidSchema,
} from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import {
  addItem,
  createWatchlist,
  deleteWatchlist,
  listWatchlists,
  removeItem,
  renameWatchlist,
} from "../services/watchlists.js";

const idParam = z.object({ id: cuidSchema }).strict();
const itemParams = z.object({ id: cuidSchema, itemId: cuidSchema }).strict();

/**
 * Watchlist routes. Every handler: authenticate -> authorize/validate ->
 * service -> response. All responses are personalized -> no-store.
 */
export async function watchlistRoutes(app: FastifyInstance, deps: AuthDeps) {
  app.get("/api/v1/watchlists", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps);
    reply.header("Cache-Control", "no-store");
    return { data: await listWatchlists(ctx.userId) };
  });

  app.post("/api/v1/watchlists", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps);
    const { name } = validate(createWatchlistSchema, req.body);
    reply.header("Cache-Control", "no-store");
    reply.code(201);
    return { data: await createWatchlist(ctx.userId, ctx.plan, name) };
  });

  app.patch("/api/v1/watchlists/:id", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps);
    const { id } = validate(idParam, req.params);
    const { name } = validate(createWatchlistSchema, req.body);
    reply.header("Cache-Control", "no-store");
    return { data: await renameWatchlist(ctx.userId, id, name) };
  });

  app.delete("/api/v1/watchlists/:id", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps);
    const { id } = validate(idParam, req.params);
    await deleteWatchlist(ctx.userId, id);
    reply.header("Cache-Control", "no-store");
    return { data: { deleted: true } };
  });

  app.post("/api/v1/watchlists/:id/items", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps);
    const { id } = validate(idParam, req.params);
    const { ticker, note } = validate(addWatchlistItemSchema, req.body);
    reply.header("Cache-Control", "no-store");
    reply.code(201);
    return { data: await addItem(ctx.userId, id, ticker, note) };
  });

  app.delete("/api/v1/watchlists/:id/items/:itemId", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps);
    const { id, itemId } = validate(itemParams, req.params);
    await removeItem(ctx.userId, id, itemId);
    reply.header("Cache-Control", "no-store");
    return { data: { deleted: true } };
  });
}
