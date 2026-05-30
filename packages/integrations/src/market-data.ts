/**
 * Market-data provider abstraction. Each vendor is wrapped behind this typed
 * interface so fallbacks/swaps stay localized. Primary = Polygon, fallback =
 * Twelve Data. Callers depend on the interface, never a concrete vendor.
 */
export interface NormalizedQuote {
  ticker: string;
  price: number;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  asOf: string; // ISO
  source: string;
}

export interface MarketDataProvider {
  readonly name: string;
  getQuote(ticker: string): Promise<NormalizedQuote>;
}

/**
 * Wraps a primary provider with a fallback. If the primary throws (rate limit,
 * outage), the fallback is tried transparently. Surfaced in admin monitoring
 * via the onFailover hook.
 */
export class FailoverMarketData implements MarketDataProvider {
  readonly name = "failover";

  constructor(
    private readonly primary: MarketDataProvider,
    private readonly fallback: MarketDataProvider,
    private readonly onFailover?: (err: unknown) => void,
  ) {}

  async getQuote(ticker: string): Promise<NormalizedQuote> {
    try {
      return await this.primary.getQuote(ticker);
    } catch (err) {
      this.onFailover?.(err);
      return this.fallback.getQuote(ticker);
    }
  }
}

/** Placeholder concrete providers — real HTTP calls added in Layer 1. */
export class PolygonProvider implements MarketDataProvider {
  readonly name = "polygon";
  constructor(private readonly apiKey: string) {}
  async getQuote(_ticker: string): Promise<NormalizedQuote> {
    throw new Error("PolygonProvider.getQuote not implemented yet (Layer 1)");
  }
}

export class TwelveDataProvider implements MarketDataProvider {
  readonly name = "twelvedata";
  constructor(private readonly apiKey: string) {}
  async getQuote(_ticker: string): Promise<NormalizedQuote> {
    throw new Error("TwelveDataProvider.getQuote not implemented yet (Layer 1)");
  }
}
