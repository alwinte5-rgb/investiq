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

const RATE_TTL_MS = 60_000; // dashboard/calculator refresh cadence
const ATR_TTL_MS = 12 * 60 * 60 * 1000; // daily candles move once a day

export function createForexMarketService(opts: { twelveDataKey?: string }): ForexMarketService {
  const key = opts.twelveDataKey;
  const cache = new InMemoryTtlCache();

  async function getRate(pairSymbol: string) {
    const canonical = normalizePair(pairSymbol);
    if (!key || !canonical) return null;
    try {
      return await cache.wrap<{ rate: number; asOf: Date } | null>(`rate:${canonical}`, RATE_TTL_MS, async () => {
        const body = await fetchJson<{ rate?: number; timestamp?: number }>(
          "twelvedata",
          `https://api.twelvedata.com/exchange_rate?symbol=${encodeURIComponent(canonical)}&apikey=${key}`,
        );
        if (typeof body.rate !== "number" || !(body.rate > 0)) return null;
        return { rate: body.rate, asOf: body.timestamp ? new Date(body.timestamp * 1000) : new Date() };
      });
    } catch {
      return null;
    }
  }

  async function getAtr(pairSymbol: string) {
    const canonical = normalizePair(pairSymbol);
    if (!key || !canonical) return null;
    try {
      return await cache.wrap<number | null>(`atr:${canonical}`, ATR_TTL_MS, async () => {
        const body = await fetchJson<{ values?: { high: string; low: string; close: string }[] }>(
          "twelvedata",
          `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(canonical)}&interval=1day&outputsize=16&apikey=${key}`,
        );
        if (!Array.isArray(body.values) || body.values.length < 2) return null;
        // Twelve Data returns newest-first; ATR helper is order-sensitive on prevClose.
        const candles = [...body.values].reverse().map((v) => ({
          high: Number(v.high),
          low: Number(v.low),
          close: Number(v.close),
        }));
        if (candles.some((c) => !(c.high > 0) || !(c.low > 0) || !(c.close > 0))) return null;
        return averageTrueRange(candles, 14);
      });
    } catch {
      return null;
    }
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
