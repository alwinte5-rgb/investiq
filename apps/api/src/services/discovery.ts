import { InMemoryTtlCache, fetchFmpScreener, type ScreenCriteria, type ScreenedStock } from "@investiq/integrations";

/**
 * Discovery engine — surfaces NEW ideas to research using the FMP company
 * screener. These are REAL listed stocks matching transparent, factual criteria
 * (market cap, beta, dividend) — explicitly NOT AI recommendations or "Watch"
 * signals. They are starting points the user can then analyze. Non-personalized
 * and shared, so results are cached. Returns [] when no FMP key is configured.
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
    key: "large-cap",
    title: "Large-cap leaders",
    blurb: "The biggest US companies by market value — common starting points to research.",
    criteria: { marketCapMoreThan: 100_000_000_000, isEtf: false, limit: 8 },
  },
  {
    key: "dividend",
    title: "Dividend payers",
    blurb: "Established US companies that pay a dividend.",
    criteria: { dividendMoreThan: 1, marketCapMoreThan: 20_000_000_000, isEtf: false, limit: 8 },
  },
  {
    key: "low-vol",
    title: "Lower-volatility large caps",
    blurb: "Large caps that have historically moved less than the market (beta < 0.9).",
    criteria: { betaLowerThan: 0.9, marketCapMoreThan: 50_000_000_000, isEtf: false, limit: 8 },
  },
];

export function createDiscoveryService(opts: { fmpKey?: string; fmpBaseUrl?: string }): DiscoveryService {
  const cache = new InMemoryTtlCache();

  async function getDiscovery(): Promise<DiscoveryGroup[]> {
    if (!opts.fmpKey) return [];
    const key = opts.fmpKey;
    return cache.wrap("discovery", DISCOVERY_TTL_MS, async () => {
      const settled = await Promise.allSettled(
        SCREENS.map((s) =>
          fetchFmpScreener({ apiKey: key, baseUrl: opts.fmpBaseUrl, criteria: s.criteria }),
        ),
      );
      const groups: DiscoveryGroup[] = [];
      settled.forEach((r, i) => {
        const s = SCREENS[i];
        if (!s) return;
        const items = r.status === "fulfilled" ? r.value : [];
        if (items.length > 0) groups.push({ key: s.key, title: s.title, blurb: s.blurb, items });
      });
      return groups;
    });
  }

  return { getDiscovery, enabled: Boolean(opts.fmpKey) };
}
