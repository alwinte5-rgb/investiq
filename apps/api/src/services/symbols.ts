import { prisma } from "@investiq/db";
import type { AssetType } from "@investiq/db";

export interface SymbolResult {
  ticker: string;
  name: string;
  assetType: AssetType;
  exchange: string | null;
  sector: string | null;
}

/**
 * Search the constrained US stock/ETF universe by ticker or name. Ticker-prefix
 * matches rank first, then name matches. Only active symbols are returned.
 * Non-personalized (shareable / cacheable at the edge later).
 */
export async function searchSymbols(q: string, limit = 20): Promise<SymbolResult[]> {
  const term = q.trim();
  if (!term) return [];

  const results = await prisma.symbol.findMany({
    where: {
      active: true,
      OR: [
        { ticker: { startsWith: term.toUpperCase() } },
        { name: { contains: term, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: [{ ticker: "asc" }],
    select: { ticker: true, name: true, assetType: true, exchange: true, sector: true },
  });

  // Rank exact/prefix ticker hits ahead of name-only hits.
  const upper = term.toUpperCase();
  return results.sort((a, b) => {
    const aPrefix = a.ticker.startsWith(upper) ? 0 : 1;
    const bPrefix = b.ticker.startsWith(upper) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return a.ticker.localeCompare(b.ticker);
  });
}

/** Resolve a ticker to its Symbol id, or null. Used when adding watchlist items. */
export async function findSymbolByTicker(ticker: string): Promise<{ id: string } | null> {
  return prisma.symbol.findFirst({
    where: { ticker: ticker.toUpperCase(), active: true },
    select: { id: true },
  });
}
