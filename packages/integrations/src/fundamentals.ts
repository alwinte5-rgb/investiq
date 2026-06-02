import { fetchJson, UpstreamError } from "./http.js";

/**
 * Company fundamentals for a US stock/ETF. Normalized across providers so the
 * AI evidence bundle has a stable FUNDAMENTAL datum shape. Any field may be null
 * when the provider omits it (e.g. ETFs have no P/E or sector).
 */
export interface NormalizedFundamentals {
  ticker: string;
  marketCap: number | null;
  beta: number | null;
  pe: number | null;
  eps: number | null;
  sector: string | null;
  industry: string | null;
  price: number | null;
  asOf: string; // ISO
  source: string;
}

export interface FundamentalsProvider {
  readonly name: string;
  getFundamentals(ticker: string): Promise<NormalizedFundamentals>;
}

interface FmpProfile {
  symbol?: string;
  price?: number | null;
  beta?: number | null;
  mktCap?: number | null;
  sector?: string | null;
  industry?: string | null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Parse an FMP `/profile` array response into the normalized shape. Exported for tests. */
export function parseFmpProfile(ticker: string, raw: unknown): NormalizedFundamentals {
  const row: FmpProfile = Array.isArray(raw) ? (raw[0] ?? {}) : ((raw as FmpProfile) ?? {});
  return {
    ticker: ticker.toUpperCase(),
    marketCap: num(row.mktCap),
    beta: num(row.beta),
    pe: null, // not present on /profile; left null (ETFs/some symbols lack it anyway)
    eps: null,
    sector: typeof row.sector === "string" && row.sector ? row.sector : null,
    industry: typeof row.industry === "string" && row.industry ? row.industry : null,
    price: num(row.price),
    asOf: new Date().toISOString(),
    source: "fmp",
  };
}

/**
 * Financial Modeling Prep fundamentals. Uses the company profile endpoint
 * (market cap, beta, sector). A profile with no usable fields is treated as
 * "no data" so the caller's evidence bundle stays honest.
 */
export class FmpProvider implements FundamentalsProvider {
  readonly name = "fmp";
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://financialmodelingprep.com",
  ) {}

  async getFundamentals(ticker: string): Promise<NormalizedFundamentals> {
    const t = encodeURIComponent(ticker.toUpperCase());
    const url = `${this.baseUrl}/api/v3/profile/${t}?apikey=${encodeURIComponent(this.apiKey)}`;
    const raw = await fetchJson<unknown>("fmp", url);
    const parsed = parseFmpProfile(ticker, raw);
    // If the provider returned a row but nothing usable, surface as upstream "no data".
    if (parsed.marketCap === null && parsed.sector === null && parsed.beta === null && parsed.price === null) {
      throw new UpstreamError("fmp", `No fundamentals for ${ticker}`);
    }
    return parsed;
  }
}
