import { InMemoryTtlCache, fetchJson } from "@investiq/integrations";
import {
  averageTrueRange,
  findPair,
  normalizePair,
  suggestedLevels,
  type SuggestedLevels,
  type TradeDirection,
} from "@investiq/shared";

/**
 * Forex market data (Twelve Data) — live rate + daily-ATR volatility, powering
 * the "suggested stop & target" feature. Educational volatility math only,
 * never a directional signal. Degrades gracefully: no key or provider error →
 * category-default suggestions and no live rate.
 */

export interface PairInsight {
  pairSymbol: string;
  /** Live mid rate; null when no provider/live data. */
  rate: number | null;
  rateAsOf: string | null;
  /** ATR(14) of daily candles in pips; null when unavailable. */
  atrPips: number | null;
  /** Suggested stop/TP for the given direction+entry; null when entry unusable. */
  suggested: SuggestedLevels | null;
}

export interface ForexMarketService {
  readonly enabled: boolean;
  getRate(pairSymbol: string): Promise<{ rate: number; asOf: Date } | null>;
  getAtr(pairSymbol: string): Promise<number | null>;
  getInsight(pairSymbol: string, direction: TradeDirection, entry: number | null, preferredRR: number | null): Promise<PairInsight>;
}

const RATE_TTL_MS = 90_000; // dashboard/calculator refresh cadence
const ATR_TTL_MS = 12 * 60 * 60 * 1000; // daily candles move once a day

export function createForexMarketService(opts: { twelveDataKey?: string }): ForexMarketService {
  const key = opts.twelveDataKey;
  const cache = new InMemoryTtlCache();
  // Single-flight per cache key: bursts (guest traffic, Promise.all fan-outs)
  // share one upstream request instead of stampeding the 8-credit/min limit.
  const inflight = new Map<string, Promise<unknown>>();

  /**
   * Cache SUCCESSES only. Twelve Data reports rate-limit/errors in a 200 body
   * ({ code, status:"error" }), so a failed fetch must throw — never be cached —
   * or one throttled minute poisons the rate for RATE_TTL and ATR for 12h.
   */
  async function cached<T>(cacheKey: string, ttl: number, compute: () => Promise<T>): Promise<T | null> {
    const hit = cache.get<T>(cacheKey);
    if (hit !== undefined) return hit;
    const existing = inflight.get(cacheKey);
    if (existing) return existing.then((v) => v as T).catch(() => null);
    const p = compute()
      .then((value) => {
        cache.set(cacheKey, value, ttl);
        return value;
      })
      .finally(() => inflight.delete(cacheKey));
    inflight.set(cacheKey, p);
    return p.catch(() => null);
  }

  function assertNotProviderError(body: Record<string, unknown>): void {
    if (body && (body as { status?: string }).status === "error") {
      throw new Error(`twelvedata error ${(body as { code?: number }).code ?? ""}`);
    }
  }

  async function getRate(pairSymbol: string) {
    const canonical = normalizePair(pairSymbol);
    if (!key || !canonical) return null;
    return cached<{ rate: number; asOf: Date }>(`rate:${canonical}`, RATE_TTL_MS, async () => {
      const body = await fetchJson<{ rate?: number; timestamp?: number }>(
        "twelvedata",
        `https://api.twelvedata.com/exchange_rate?symbol=${encodeURIComponent(canonical)}&apikey=${key}`,
      );
      assertNotProviderError(body as Record<string, unknown>);
      if (typeof body.rate !== "number" || !(body.rate > 0)) throw new Error("no rate in response");
      return { rate: body.rate, asOf: body.timestamp ? new Date(body.timestamp * 1000) : new Date() };
    });
  }

  async function getAtr(pairSymbol: string) {
    const canonical = normalizePair(pairSymbol);
    if (!key || !canonical) return null;
    return cached<number>(`atr:${canonical}`, ATR_TTL_MS, async () => {
      const body = await fetchJson<{ values?: { high: string; low: string; close: string }[] }>(
        "twelvedata",
        `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(canonical)}&interval=1day&outputsize=16&apikey=${key}`,
      );
      assertNotProviderError(body as Record<string, unknown>);
      if (!Array.isArray(body.values) || body.values.length < 2) throw new Error("no candles in response");
      // Twelve Data returns newest-first; ATR helper is order-sensitive on prevClose.
      const candles = [...body.values].reverse().map((v) => ({
        high: Number(v.high),
        low: Number(v.low),
        close: Number(v.close),
      }));
      if (candles.some((c) => !(c.high > 0) || !(c.low > 0) || !(c.close > 0))) throw new Error("bad candle data");
      const atr = averageTrueRange(candles, 14);
      if (atr == null) throw new Error("insufficient candles for ATR");
      return atr;
    });
  }

  return {
    enabled: Boolean(key),
    getRate,
    getAtr,
    async getInsight(pairSymbol, direction, entry, preferredRR) {
      const canonical = normalizePair(pairSymbol) ?? pairSymbol;
      const [rate, atr] = await Promise.all([getRate(canonical), getAtr(canonical)]);
      const entryPrice = entry ?? rate?.rate ?? null;
      const info = findPair(canonical);
      const suggested =
        entryPrice != null
          ? suggestedLevels({
              direction,
              entryPrice,
              pairSymbol: canonical,
              atr,
              category: info?.category,
              preferredRewardRatio: preferredRR,
            })
          : null;
      return {
        pairSymbol: canonical,
        rate: rate?.rate ?? null,
        rateAsOf: rate?.asOf.toISOString() ?? null,
        atrPips: suggested?.atrPips ?? null,
        suggested,
      };
    },
  };
}
