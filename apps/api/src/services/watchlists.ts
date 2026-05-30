import { prisma } from "@investiq/db";
import { entitlementsFor, errors, type Plan } from "@investiq/shared";
import { assertOwnedBy } from "../lib/permissions.js";
import { findSymbolByTicker } from "./symbols.js";

/**
 * Watchlist business logic. Every operation is scoped to the owning user and
 * re-checks object-level ownership before mutating — no IDOR. Plan limits are
 * enforced here (server-side), not in the UI.
 */

export async function listWatchlists(userId: string) {
  return prisma.watchlist.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: { symbol: { select: { ticker: true, name: true, assetType: true } } },
      },
    },
  });
}

export async function createWatchlist(userId: string, plan: Plan, name: string) {
  const limit = entitlementsFor(plan).maxWatchlists;
  const count = await prisma.watchlist.count({ where: { userId } });
  if (count >= limit) {
    throw errors.quota(
      limit === 1
        ? "Free plan allows 1 watchlist. Upgrade for unlimited watchlists."
        : "Watchlist limit reached for your plan.",
    );
  }
  return prisma.watchlist.create({ data: { userId, name } });
}

export async function renameWatchlist(userId: string, id: string, name: string) {
  const existing = await prisma.watchlist.findUnique({ where: { id } });
  assertOwnedBy(userId, existing); // throws if missing or not owner
  return prisma.watchlist.update({ where: { id }, data: { name } });
}

export async function deleteWatchlist(userId: string, id: string) {
  const existing = await prisma.watchlist.findUnique({ where: { id } });
  assertOwnedBy(userId, existing);
  await prisma.watchlist.delete({ where: { id } }); // cascades items
}

export async function addItem(
  userId: string,
  watchlistId: string,
  ticker: string,
  note?: string,
) {
  const wl = await prisma.watchlist.findUnique({ where: { id: watchlistId } });
  assertOwnedBy(userId, wl);

  const symbol = await findSymbolByTicker(ticker);
  if (!symbol) throw errors.notFound(`Unknown or unsupported symbol: ${ticker}`);

  const dup = await prisma.watchlistItem.findUnique({
    where: { watchlistId_symbolId: { watchlistId, symbolId: symbol.id } },
  });
  if (dup) throw errors.validation("Symbol is already in this watchlist");

  return prisma.watchlistItem.create({
    data: { watchlistId, symbolId: symbol.id, note: note ?? null },
    include: { symbol: { select: { ticker: true, name: true, assetType: true } } },
  });
}

export async function removeItem(userId: string, watchlistId: string, itemId: string) {
  const wl = await prisma.watchlist.findUnique({ where: { id: watchlistId } });
  assertOwnedBy(userId, wl);

  const item = await prisma.watchlistItem.findUnique({ where: { id: itemId } });
  if (!item || item.watchlistId !== watchlistId) throw errors.notFound();

  await prisma.watchlistItem.delete({ where: { id: itemId } });
}
