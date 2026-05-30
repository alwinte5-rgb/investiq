import {
  FailoverMarketData,
  InMemoryTtlCache,
  PolygonProvider,
  TwelveDataProvider,
  type MarketDataProvider,
  type NormalizedQuote,
} from "@investiq/integrations";

/** Index + sector proxies for the market overview (must be in the symbol universe). */
const INDEX_TICKERS = ["SPY", "QQQ", "DIA", "IWM"];
const SECTOR_TICKERS = ["XLK", "XLE"];

const QUOTE_TTL_MS = 15_000;
const OVERVIEW_TTL_MS = 30_000;

export interface MarketOverview {
  indices: NormalizedQuote[];
  sectors: NormalizedQuote[];
  asOf: string;
}

export interface MarketService {
  getQuote(ticker: string): Promise<NormalizedQuote>;
  getOverview(): Promise<MarketOverview>;
}

export interface MarketServiceOptions {
  polygonKey: string;
  twelveDataKey: string;
  onFailover?: (err: unknown) => void;
}

/**
 * Market data service. Polygon primary, Twelve Data fallback, results cached in
 * a shared (non-personalized) TTL cache. Overview tolerates partial failures so
 * one bad symbol doesn't blank the whole screen.
 */
export function createMarketService(opts: MarketServiceOptions): MarketService {
  const provider: MarketDataProvider = new FailoverMarketData(
    new PolygonProvider(opts.polygonKey),
    new TwelveDataProvider(opts.twelveDataKey),
    opts.onFailover,
  );
  const cache = new InMemoryTtlCache();

  async function getQuote(ticker: string): Promise<NormalizedQuote> {
    const key = `quote:${ticker.toUpperCase()}`;
    return cache.wrap(key, QUOTE_TTL_MS, () => provider.getQuote(ticker));
  }

  async function quotesFor(tickers: string[]): Promise<NormalizedQuote[]> {
    const settled = await Promise.allSettled(tickers.map((t) => getQuote(t)));
    return settled
      .filter((r): r is PromiseFulfilledResult<NormalizedQuote> => r.status === "fulfilled")
      .map((r) => r.value);
  }

  async function getOverview(): Promise<MarketOverview> {
    return cache.wrap("overview", OVERVIEW_TTL_MS, async () => {
      const [indices, sectors] = await Promise.all([
        quotesFor(INDEX_TICKERS),
        quotesFor(SECTOR_TICKERS),
      ]);
      return { indices, sectors, asOf: new Date().toISOString() };
    });
  }

  return { getQuote, getOverview };
}
