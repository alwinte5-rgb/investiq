import {
  FailoverMarketData,
  InMemoryTtlCache,
  MassiveProvider,
  TwelveDataProvider,
  UpstreamError,
  type MarketDataProvider,
  type MoverDirection,
  type MoverQuote,
  type NormalizedQuote,
} from "@investiq/integrations";

/** Index + sector proxies for the market overview (must be in the symbol universe). */
const INDEX_TICKERS = ["SPY", "QQQ", "DIA", "IWM"];
const SECTOR_TICKERS = ["XLK", "XLE"];

const QUOTE_TTL_MS = 15_000;
const OVERVIEW_TTL_MS = 30_000;
const MOVERS_TTL_MS = 60_000;
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

  return { getQuote, getOverview, getMovers, enabled: providers.length > 0 };
}
