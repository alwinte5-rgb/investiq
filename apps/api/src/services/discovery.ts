import { prisma } from "@investiq/db";
import { InMemoryTtlCache, type ScreenedStock } from "@investiq/integrations";

/**
 * Discovery — browse "ideas to research" grouped by sector. Sourced from the
 * app's symbol universe (DB), so every idea is analyzable in one tap and the
 * groups are reliably labeled (Technology, Financials, ETFs, Gaming…). No live
 * provider calls here — fast, no rate-limit exposure, never fabricated.
 */

const DISCOVERY_TTL_MS = 30 * 60 * 1000; // 30m — the universe changes rarely

export interface DiscoveryGroup {
  key: string;
  title: string;
  blurb: string;
  items: ScreenedStock[];
}

export interface DiscoveryService {
  getDiscovery(): Promise<DiscoveryGroup[]>;
  readonly enabled: boolean;
}

/** Friendly group title + ordering by sector. ETFs are grouped by asset type. */
const SECTOR_META: { match: string; key: string; title: string; blurb: string }[] = [
  { match: "Technology", key: "tech", title: "Technology", blurb: "Software, hardware and chips — growth and AI exposure." },
  { match: "Communication Services", key: "comm", title: "Communication & media", blurb: "Internet, media and telecom names." },
  { match: "Gaming & Entertainment", key: "gaming", title: "Gaming & entertainment", blurb: "Video games, streaming and entertainment." },
  { match: "Financials", key: "finance", title: "Financials", blurb: "Banks, payments and financial services." },
  { match: "Healthcare", key: "health", title: "Healthcare", blurb: "Pharma, biotech, insurers and devices." },
  { match: "Consumer Discretionary", key: "consumer", title: "Consumer", blurb: "Retail, autos, restaurants and brands." },
  { match: "Consumer Staples", key: "staples", title: "Consumer staples", blurb: "Everyday essentials — steadier demand." },
  { match: "Energy", key: "energy", title: "Energy", blurb: "Oil, gas and energy producers." },
  { match: "Industrials", key: "industrials", title: "Industrials", blurb: "Machinery, transport and defense." },
];

/** Minimal symbol shape needed to group (decoupled from Prisma for testing). */
export interface DiscoverySymbol {
  ticker: string;
  name: string;
  sector: string | null;
  assetType: string;
}

/**
 * Pure grouping: bucket the symbol universe into the fixed, friendly sector
 * order, then "Other" (stocks with an unrecognized sector), then ETFs. Empty
 * buckets are dropped, so adding a `SECTOR_META` entry with no tickers can never
 * surface a blank group. Exported for tests.
 */
export function groupSymbols(symbols: DiscoverySymbol[]): DiscoveryGroup[] {
  const toItem = (s: DiscoverySymbol): ScreenedStock => ({
    ticker: s.ticker,
    name: s.name,
    sector: s.sector,
    marketCap: null,
    price: null,
    beta: null,
    assetType: s.assetType === "ETF" ? "ETF" : "STOCK",
  });

  const groups: DiscoveryGroup[] = [];
  // Sector groups in a friendly, fixed order.
  for (const meta of SECTOR_META) {
    const items = symbols.filter((s) => s.assetType !== "ETF" && s.sector === meta.match).map(toItem);
    if (items.length > 0) groups.push({ key: meta.key, title: meta.title, blurb: meta.blurb, items });
  }
  // Any stocks whose sector didn't match a known group → "Other".
  const known = new Set(SECTOR_META.map((m) => m.match));
  const other = symbols.filter((s) => s.assetType !== "ETF" && !(s.sector && known.has(s.sector))).map(toItem);
  if (other.length > 0)
    groups.push({ key: "other", title: "Other", blurb: "More US stocks to research.", items: other });
  // ETFs last.
  const etfs = symbols.filter((s) => s.assetType === "ETF").map(toItem);
  if (etfs.length > 0)
    groups.push({ key: "etfs", title: "ETFs", blurb: "Funds — instant diversification in one ticker.", items: etfs });

  return groups;
}

export function createDiscoveryService(): DiscoveryService {
  const cache = new InMemoryTtlCache();

  async function compute(): Promise<DiscoveryGroup[]> {
    const symbols = await prisma.symbol.findMany({
      where: { active: true },
      select: { ticker: true, name: true, sector: true, assetType: true },
      orderBy: { ticker: "asc" },
    });
    if (symbols.length === 0) return [];
    return groupSymbols(symbols);
  }

  async function getDiscovery(): Promise<DiscoveryGroup[]> {
    const cached = cache.get<DiscoveryGroup[]>("discovery");
    if (cached && cached.length > 0) return cached;
    const groups = await compute();
    if (groups.length > 0) cache.set("discovery", groups, DISCOVERY_TTL_MS);
    return groups;
  }

  return { getDiscovery, enabled: true };
}
