import { InMemoryTtlCache, fetchFmpScreener, type ScreenCriteria, type ScreenedStock } from "@investiq/integrations";
import type { MarketService } from "./market.js";

/**
 * Discovery engine — surfaces NEW ideas to research across the size/risk
 * spectrum using the FMP company screener (large/mid/small-cap, growth, ETFs).
 * These are REAL listed stocks matching transparent, factual criteria — NOT AI
 * recommendations or "Watch" signals; just starting points to analyze. Shared +
 * cached. If the screener is unavailable (plan tier), it falls back to live
 * popular quotes so the section is never empty. Never fabricates.
 */

const DISCOVERY_TTL_MS = 60 * 60 * 1000; // 1h — screens move slowly

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

const SCREENS: { key: string; title: string; blurb: string; criteria: ScreenCriteria }[] = [
  {
    key: "ai-semis",
    title: "AI & semiconductors",
    blurb: "Technology names riding the AI / data-center wave — high growth, higher risk.",
    criteria: { sector: "Technology", marketCapMoreThan: 5_000_000_000, betaMoreThan: 1, isEtf: false, limit: 8 },
  },
  {
    key: "growth",
    title: "Growth movers",
    blurb: "$2B–$50B companies moving faster than the market (beta > 1.3) — growth potential, more risk.",
    criteria: { marketCapMoreThan: 2_000_000_000, marketCapLowerThan: 50_000_000_000, betaMoreThan: 1.3, isEtf: false, limit: 8 },
  },
  {
    key: "value-dividend",
    title: "Value & dividends",
    blurb: "Steadier large caps paying a dividend (beta < 1.1) — income and lower volatility.",
    criteria: { dividendMoreThan: 1, betaLowerThan: 1.1, marketCapMoreThan: 20_000_000_000, isEtf: false, limit: 8 },
  },
  {
    key: "small-cap",
    title: "Small-cap & emerging",
    blurb: "$300M–$2B companies — lesser-known, higher risk and higher potential reward.",
    criteria: { marketCapMoreThan: 300_000_000, marketCapLowerThan: 2_000_000_000, priceMoreThan: 2, isEtf: false, limit: 8 },
  },
  {
    key: "large-cap",
    title: "Large-cap leaders",
    blurb: "The biggest US companies by market value — steadier starting points.",
    criteria: { marketCapMoreThan: 100_000_000_000, isEtf: false, limit: 8 },
  },
  {
    key: "etfs",
    title: "ETFs",
    blurb: "Exchange-traded funds — instant diversification in a single ticker.",
    criteria: { isEtf: true, limit: 8 },
  },
];

export function createDiscoveryService(opts: {
  fmpKey?: string;
  fmpBaseUrl?: string;
  market?: MarketService;
}): DiscoveryService {
  const cache = new InMemoryTtlCache();

  async function popularFallback(): Promise<DiscoveryGroup[]> {
    if (!opts.market) return [];
    try {
      const quotes = await opts.market.getPopular();
      if (quotes.length === 0) return [];
      return [
        {
          key: "popular",
          title: "Popular to research",
          blurb: "Widely-held US stocks and ETFs with live quotes.",
          items: quotes.map((q) => ({
            ticker: q.ticker,
            name: q.ticker,
            sector: null,
            marketCap: null,
            price: q.price,
            beta: null,
            assetType: "STOCK" as const,
          })),
        },
      ];
    } catch {
      return [];
    }
  }

  async function compute(): Promise<DiscoveryGroup[]> {
    const groups: DiscoveryGroup[] = [];
    if (opts.fmpKey) {
      const key = opts.fmpKey;
      const settled = await Promise.allSettled(
        SCREENS.map((s) =>
          fetchFmpScreener({ apiKey: key, baseUrl: opts.fmpBaseUrl, criteria: s.criteria }),
        ),
      );
      settled.forEach((r, i) => {
        const s = SCREENS[i];
        if (!s) return;
        const items = r.status === "fulfilled" ? r.value : [];
        if (items.length > 0) groups.push({ key: s.key, title: s.title, blurb: s.blurb, items });
      });
    }
    // Never leave the section empty — fall back to live popular quotes.
    if (groups.length === 0) return popularFallback();
    return groups;
  }

  async function getDiscovery(): Promise<DiscoveryGroup[]> {
    // Cache only NON-empty results, so a transient empty (provider hiccup) can't
    // poison the section for the whole TTL — the next request just recomputes.
    const cached = cache.get<DiscoveryGroup[]>("discovery");
    if (cached && cached.length > 0) return cached;
    const groups = await compute();
    if (groups.length > 0) cache.set("discovery", groups, DISCOVERY_TTL_MS);
    return groups;
  }

  return { getDiscovery, enabled: Boolean(opts.fmpKey || opts.market) };
}
