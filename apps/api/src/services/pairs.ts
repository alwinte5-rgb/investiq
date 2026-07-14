import { prisma } from "@investiq/db";
import {
  errors,
  findPair,
  directionExplanations,
  DEFAULT_WATCHLIST_SYMBOLS,
  MARKET_SESSIONS,
  type CurrencyPairInfo,
} from "@investiq/shared";
import { assertOwnedBy } from "../lib/permissions.js";

/**
 * Currency pairs + saved-pair watchlist. Catalog rows come from the DB (seeded
 * from the shared catalog); educational metadata (sessions, central banks,
 * events, labels) comes from the shared catalog itself — static reference
 * content, single source of truth.
 */

function decorate(row: { symbol: string; category: string } & Record<string, unknown>) {
  const info: CurrencyPairInfo | undefined = findPair(row.symbol);
  return {
    ...row,
    category: row.category,
    pipSize: Number(row.pipSize),
    pipetteSize: Number(row.pipetteSize),
    sessions: info?.sessions ?? [],
    centralBanks: info?.centralBanks ?? [],
    economies: info?.economies ?? [],
    commonEvents: info?.commonEvents ?? [],
    educationLabels: info?.educationLabels ?? [],
    explanations: info ? directionExplanations(info) : null,
  };
}

export async function listPairs() {
  const rows = await prisma.currencyPair.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { symbol: "asc" }],
  });
  const decorated = rows.map(decorate);
  return {
    majors: decorated.filter((p) => p.category === "MAJOR"),
    minors: decorated.filter((p) => p.category === "MINOR"),
    exotics: decorated.filter((p) => p.category === "EXOTIC"),
    sessions: MARKET_SESSIONS.map((s) => ({ id: s.id, name: s.name })),
  };
}

export async function getPair(symbol: string) {
  const row = await prisma.currencyPair.findUnique({ where: { symbol } });
  if (!row || !row.active) throw errors.notFound(`Unknown currency pair: ${symbol}`);
  return decorate(row);
}

export async function listSavedPairs(userId: string) {
  const rows = await prisma.savedPair.findMany({
    where: { userId },
    orderBy: { displayOrder: "asc" },
    include: { pair: true },
  });
  // First visit: fall back to the default watchlist (not persisted until the
  // user customizes) so the dashboard is useful immediately.
  if (rows.length === 0) {
    const defaults = await prisma.currencyPair.findMany({
      where: { symbol: { in: DEFAULT_WATCHLIST_SYMBOLS }, active: true },
    });
    const bySymbol = new Map(defaults.map((d) => [d.symbol, d]));
    return {
      customized: false,
      pairs: DEFAULT_WATCHLIST_SYMBOLS.filter((s) => bySymbol.has(s)).map((s) => decorate(bySymbol.get(s)!)),
    };
  }
  return { customized: true, pairs: rows.map((r) => decorate(r.pair)) };
}

export async function savePair(userId: string, pairSymbol: string) {
  const pair = await prisma.currencyPair.findUnique({ where: { symbol: pairSymbol } });
  if (!pair || !pair.active) throw errors.notFound(`Unknown currency pair: ${pairSymbol}`);
  const last = await prisma.savedPair.findFirst({ where: { userId }, orderBy: { displayOrder: "desc" } });
  return prisma.savedPair.upsert({
    where: { userId_pairId: { userId, pairId: pair.id } },
    update: {},
    create: { userId, pairId: pair.id, displayOrder: (last?.displayOrder ?? -1) + 1 },
  });
}

export async function removeSavedPair(userId: string, id: string) {
  const existing = await prisma.savedPair.findUnique({ where: { id } });
  assertOwnedBy(userId, existing);
  await prisma.savedPair.delete({ where: { id } });
}
