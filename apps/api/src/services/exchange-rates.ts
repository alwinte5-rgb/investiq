import { InMemoryTtlCache, fetchJson, UpstreamError } from "@investiq/integrations";
import { normalizePair, type RateTable } from "@investiq/shared";

/**
 * Exchange rates — provider-agnostic service (Phase-4 ready).
 *
 * The product works WITHOUT a live provider: calculators accept manual rates
 * and default the traded pair's rate to its entry price. When a provider is
 * wired, this service is the only place that changes. Never scatter rate
 * fetching through routes or components.
 */

export interface RatesResult {
  /** Rates keyed by canonical "BASE/QUOTE". Missing pairs are simply absent. */
  rates: RateTable;
  /** When the provider produced these rates (null = no live data). */
  lastUpdated: string | null;
  /** True when rates are older than the freshness window or absent. */
  stale: boolean;
  provider: string;
}

export interface ExchangeRateProvider {
  readonly name: string;
  readonly enabled: boolean;
  /** Fetch current rates for canonical pair symbols. Throws UpstreamError on failure. */
  getRates(pairs: string[]): Promise<{ rates: RateTable; asOf: Date }>;
}

/** No provider configured: calculators fall back to manual/entry-price rates. */
export function createNullRateProvider(): ExchangeRateProvider {
  return {
    name: "none",
    enabled: false,
    async getRates() {
      return { rates: {}, asOf: new Date(0) };
    },
  };
}

/**
 * Twelve Data FX adapter (Phase 4). Interface-conformant and behind the same
 * key the stock stack used; NOT registered by default — server.ts opts in when
 * live rates are wanted. Free-tier friendly: one batched request per call.
 */
export function createTwelveDataRateProvider(apiKey: string): ExchangeRateProvider {
  return {
    name: "twelvedata",
    enabled: true,
    async getRates(pairs: string[]) {
      const symbols = pairs.join(",");
      const url = `https://api.twelvedata.com/exchange_rate?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}`;
      const body = await fetchJson<Record<string, { symbol?: string; rate?: number } | { symbol?: string; rate?: number }[]>>(
        "twelvedata",
        url,
      );
      const rates: RateTable = {};
      const entries = pairs.length === 1 ? [body as { symbol?: string; rate?: number }] : Object.values(body ?? {});
      for (const entry of entries.flat()) {
        if (entry && typeof entry === "object" && typeof entry.rate === "number" && entry.symbol) {
          const canonical = normalizePair(entry.symbol);
          if (canonical && entry.rate > 0) rates[canonical] = entry.rate;
        }
      }
      if (Object.keys(rates).length === 0) throw new UpstreamError("twelvedata", "No FX rates returned");
      return { rates, asOf: new Date() };
    },
  };
}

/** Rates older than this are flagged stale (provider data, not manual input). */
const FRESHNESS_MS = 15 * 60 * 1000;
/** Cache successful provider responses briefly to respect free-tier limits. */
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface ExchangeRateService {
  readonly enabled: boolean;
  getRates(pairs: string[]): Promise<RatesResult>;
}

export function createExchangeRateService(provider: ExchangeRateProvider): ExchangeRateService {
  const cache = new InMemoryTtlCache();

  return {
    enabled: provider.enabled,
    async getRates(pairs: string[]): Promise<RatesResult> {
      const canonical = [...new Set(pairs.map((p) => normalizePair(p)).filter((p): p is string => p != null))].sort();
      if (!provider.enabled || canonical.length === 0) {
        return { rates: {}, lastUpdated: null, stale: true, provider: provider.name };
      }
      const key = canonical.join(",");
      try {
        const { rates, asOf } = await cache.wrap<{ rates: RateTable; asOf: Date }>(key, CACHE_TTL_MS, () =>
          provider.getRates(canonical),
        );
        return {
          rates,
          lastUpdated: asOf.toISOString(),
          stale: Date.now() - asOf.getTime() > FRESHNESS_MS,
          provider: provider.name,
        };
      } catch {
        // Degrade gracefully: no fabricated rates; clients fall back to manual entry.
        return { rates: {}, lastUpdated: null, stale: true, provider: provider.name };
      }
    },
  };
}
