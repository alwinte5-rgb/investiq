import {
  FailoverMarketData,
  InMemoryTtlCache,
  MassiveProvider,
  TwelveDataProvider,
  UpstreamError,
  fetchPolygonTechnicals,
  type MarketDataProvider,
  type MoverDirection,
  type MoverQuote,
  type NormalizedQuote,
  type NormalizedTechnicals,
} from "@investiq/integrations";

/** Index + sector proxies for the market overview (must be in the symbol universe). */
const INDEX_TICKERS = ["SPY", "QQQ", "DIA", "IWM"];
const SECTOR_TICKERS = ["XLK", "XLE"];
/** Widely-held US names — a reliable "ideas to research" fallback when the
 *  provider's gainers/losers snapshot isn't available (e.g. plan tier). */
const POPULAR_TICKERS = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "JPM", "V", "SPY", "QQQ", "AMD"];

const QUOTE_TTL_MS = 15_000; // per-stock quote (analysis/risk) — kept fresh; on-demand, not per-page-load
// The dashboard/research LISTS (index overview, popular ideas, movers) refresh a
// few times a day instead of every page load — they're context, not live tickers,
// so a long shared cache slashes provider calls (Twelve Data 8/min, Polygon 5/min)
// and avoids the per-minute burst that caused "No current price".
const OVERVIEW_TTL_MS = 12 * 60 * 60 * 1000; // 12h (also used by getPopular)
const MOVERS_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const MOVERS_LIMIT = 10;

export interface MarketOverview {
  indices: NormalizedQuote[];
  sectors: NormalizedQuote[];
  asOf: string;
}

export interface MarketMovers {
  gainers: MoverQuote[];
  losers: MoverQuote[];
  asOf: string;
}

export interface MarketService {
  getQuote(ticker: string): Promise<NormalizedQuote>;
  getOverview(): Promise<MarketOverview>;
  getMovers(): Promise<MarketMovers>;
  /** Widely-held names with live quotes — reliable discovery fallback. */
  getPopular(): Promise<NormalizedQuote[]>;
  /** Technical indicators (Polygon). Null when no Polygon key, or none resolved. */
  getTechnicals(ticker: string): Promise<NormalizedTechnicals | null>;
  /** True when at least one provider key is configured. */
  readonly enabled: boolean;
}

export interface MarketServiceOptions {
  twelveDataKey?: string;
  massiveKey?: string;
  massiveBaseUrl?: string;
  onFailover?: (err: unknown) => void;
}

/** Chain providers with failover in order; throws upstream if none configured. */
function buildProvider(
  providers: MarketDataProvider[],
  onFailover?: (err: unknown) => void,
): MarketDataProvider {
  if (providers.length === 0) {
    return {
      name: "none",
      async getQuote(): Promise<NormalizedQuote> {
        throw new UpstreamError("market", "No market-data provider configured");
      },
      async getMovers(): Promise<MoverQuote[]> {
        throw new UpstreamError("market", "No market-data provider configured");
      },
    };
  }
  return providers.reduce((acc, next) => new FailoverMarketData(acc, next, onFailover));
}

/**
 * Market data service. Twelve Data is the primary provider; Massive (ex-Polygon)
 * is the fallback. Providers without a configured key are skipped, so the app
 * runs with whatever keys are present. Results are cached in a shared
 * (non-personalized) TTL cache; the overview tolerates partial failures.
 */
export function createMarketService(opts: MarketServiceOptions): MarketService {
  const providers: MarketDataProvider[] = [];
  if (opts.twelveDataKey) providers.push(new TwelveDataProvider(opts.twelveDataKey));
  if (opts.massiveKey) providers.push(new MassiveProvider(opts.massiveKey, opts.massiveBaseUrl));

  const provider = buildProvider(providers, opts.onFailover);
  const cache = new InMemoryTtlCache();

  async function getQuote(ticker: string): Promise<NormalizedQuote> {
    return cache.wrap(`quote:${ticker.toUpperCase()}`, QUOTE_TTL_MS, () =>
      provider.getQuote(ticker),
    );
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

  async function moversFor(direction: MoverDirection): Promise<MoverQuote[]> {
    try {
      return await provider.getMovers(direction, MOVERS_LIMIT);
    } catch {
      return []; // tolerate provider gaps — show what we have, never fabricate
    }
  }

  async function getMovers(): Promise<MarketMovers> {
    return cache.wrap("movers", MOVERS_TTL_MS, async () => {
      const [gainers, losers] = await Promise.all([moversFor("gainers"), moversFor("losers")]);
      return { gainers, losers, asOf: new Date().toISOString() };
    });
  }

  async function getPopular(): Promise<NormalizedQuote[]> {
    return cache.wrap("popular", OVERVIEW_TTL_MS, () => quotesFor(POPULAR_TICKERS));
  }

  async function getTechnicals(ticker: string): Promise<NormalizedTechnicals | null> {
    // Technical indicators come from Polygon (Massive) only.
    if (!opts.massiveKey) return null;
    const key = opts.massiveKey;
    return cache.wrap(`tech:${ticker.toUpperCase()}`, QUOTE_TTL_MS, async () => {
      try {
        const t = await fetchPolygonTechnicals({
          apiKey: key,
          baseUrl: opts.massiveBaseUrl,
          ticker,
        });
        // Only return it if at least one indicator resolved — never an empty shell.
        const any =
          t.rsi14 != null || t.sma50 != null || t.sma200 != null || t.macd != null;
        return any ? t : null;
      } catch {
        return null;
      }
    });
  }

  return { getQuote, getOverview, getMovers, getPopular, getTechnicals, enabled: providers.length > 0 };
}
