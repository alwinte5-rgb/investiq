import { fetchJson, UpstreamError } from "./http.js";

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

/** A single market mover (top gainer/loser), from a real provider snapshot. */
export interface MoverQuote {
  ticker: string;
  price: number;
  change: number | null;
  changePct: number | null;
}

export type MoverDirection = "gainers" | "losers";

export interface MarketDataProvider {
  readonly name: string;
  getQuote(ticker: string): Promise<NormalizedQuote>;
  getMovers(direction: MoverDirection, limit: number): Promise<MoverQuote[]>;
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

  async getMovers(direction: MoverDirection, limit: number): Promise<MoverQuote[]> {
    try {
      return await this.primary.getMovers(direction, limit);
    } catch (err) {
      this.onFailover?.(err);
      return this.fallback.getMovers(direction, limit);
    }
  }
}

// ---------- Massive (formerly Polygon.io) ----------
export interface MassiveSnapshot {
  status?: string;
  ticker?: {
    ticker?: string;
    todaysChange?: number;
    todaysChangePerc?: number;
    day?: { c?: number; v?: number };
    prevDay?: { c?: number; v?: number };
    lastTrade?: { p?: number };
  };
}

/** Pure parser — unit-tested with sample payloads. */
export function parseMassiveSnapshot(json: MassiveSnapshot, ticker: string): NormalizedQuote {
  const t = json.ticker;
  const price = t?.lastTrade?.p ?? t?.day?.c ?? t?.prevDay?.c;
  if (price == null || Number.isNaN(price)) {
    throw new UpstreamError("massive", `No price for ${ticker}`);
  }
  return {
    ticker: ticker.toUpperCase(),
    price,
    change: t?.todaysChange ?? null,
    changePct: t?.todaysChangePerc ?? null,
    volume: t?.day?.v ?? t?.prevDay?.v ?? null,
    asOf: new Date().toISOString(),
    source: "massive",
  };
}

export interface MassiveMoversResponse {
  status?: string;
  tickers?: NonNullable<MassiveSnapshot["ticker"]>[];
}

/** Pure parser — maps a Polygon gainers/losers snapshot to MoverQuotes. */
export function parseMassiveMovers(json: MassiveMoversResponse, limit: number): MoverQuote[] {
  const rows = json.tickers ?? [];
  const out: MoverQuote[] = [];
  for (const t of rows) {
    const ticker = t.ticker;
    const price = t.lastTrade?.p ?? t.day?.c ?? t.prevDay?.c;
    if (!ticker || price == null || Number.isNaN(price)) continue;
    out.push({
      ticker: ticker.toUpperCase(),
      price,
      change: t.todaysChange ?? null,
      changePct: t.todaysChangePerc ?? null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Massive provider (the rebranded Polygon.io). The snapshot endpoint shape is
 * the Polygon v2 format; `baseUrl` is configurable via env (MASSIVE_BASE_URL)
 * so it can be repointed if Massive changes its host.
 */
export class MassiveProvider implements MarketDataProvider {
  readonly name = "massive";
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.polygon.io",
  ) {}

  async getQuote(ticker: string): Promise<NormalizedQuote> {
    const url = `${this.baseUrl}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(
      ticker.toUpperCase(),
    )}?apiKey=${this.apiKey}`;
    const json = await fetchJson<MassiveSnapshot>("massive", url);
    return parseMassiveSnapshot(json, ticker);
  }

  async getMovers(direction: MoverDirection, limit: number): Promise<MoverQuote[]> {
    const url = `${this.baseUrl}/v2/snapshot/locale/us/markets/stocks/${direction}?apiKey=${this.apiKey}`;
    const json = await fetchJson<MassiveMoversResponse>("massive", url);
    return parseMassiveMovers(json, limit);
  }
}

// ---------- Twelve Data (fallback) ----------
export interface TwelveDataQuote {
  symbol?: string;
  close?: string | number;
  change?: string | number;
  percent_change?: string | number;
  volume?: string | number;
  datetime?: string;
  status?: string;
  message?: string;
}

const num = (v: string | number | undefined): number | null => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) ? null : n;
};

/** Pure parser — unit-tested with sample payloads. */
export function parseTwelveDataQuote(json: TwelveDataQuote, ticker: string): NormalizedQuote {
  if (json.status === "error") {
    throw new UpstreamError("twelvedata", json.message ?? "error");
  }
  const price = num(json.close);
  if (price == null) throw new UpstreamError("twelvedata", `No price for ${ticker}`);
  return {
    ticker: ticker.toUpperCase(),
    price,
    change: num(json.change),
    changePct: num(json.percent_change),
    volume: num(json.volume),
    asOf: json.datetime ? new Date(json.datetime).toISOString() : new Date().toISOString(),
    source: "twelvedata",
  };
}

export class TwelveDataProvider implements MarketDataProvider {
  readonly name = "twelvedata";
  constructor(private readonly apiKey: string) {}

  async getQuote(ticker: string): Promise<NormalizedQuote> {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(
      ticker.toUpperCase(),
    )}&apikey=${this.apiKey}`;
    const json = await fetchJson<TwelveDataQuote>("twelvedata", url);
    return parseTwelveDataQuote(json, ticker);
  }

  // Twelve Data has no comparable free gainers/losers snapshot; defer to the
  // failover chain (Polygon) so movers come from real data, never fabricated.
  async getMovers(): Promise<MoverQuote[]> {
    throw new UpstreamError("twelvedata", "movers not supported");
  }
}
