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
  // Valuation/quality ratios (TTM) — enrich the AI's fundamental evidence.
  ps: number | null;
  pb: number | null;
  roe: number | null;
  debtToEquity: number | null;
  netMargin: number | null;
  // Analyst context — fuels the ANALYST evidence datum.
  priceTargetAvg: number | null;
  analystConsensus: string | null;
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
  marketCap?: number | null;
  sector?: string | null;
  industry?: string | null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** First row of an FMP array response (their endpoints return single-element arrays). */
function firstRow(raw: unknown): Record<string, unknown> {
  if (Array.isArray(raw)) return (raw[0] as Record<string, unknown>) ?? {};
  return (raw as Record<string, unknown>) ?? {};
}

/** First finite number among candidate keys (FMP field names vary across versions). */
function pickNum(row: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const n = num(row[k]);
    if (n !== null) return n;
  }
  return null;
}

/** Parse an FMP `stable/profile` array response into the normalized shape. Exported for tests. */
export function parseFmpProfile(ticker: string, raw: unknown): NormalizedFundamentals {
  const row: FmpProfile = Array.isArray(raw) ? (raw[0] ?? {}) : ((raw as FmpProfile) ?? {});
  return {
    ticker: ticker.toUpperCase(),
    marketCap: num(row.marketCap),
    beta: num(row.beta),
    pe: null, // not present on /profile; filled from ratios-ttm when available
    eps: null,
    sector: typeof row.sector === "string" && row.sector ? row.sector : null,
    industry: typeof row.industry === "string" && row.industry ? row.industry : null,
    price: num(row.price),
    ps: null,
    pb: null,
    roe: null,
    debtToEquity: null,
    netMargin: null,
    priceTargetAvg: null,
    analystConsensus: null,
    asOf: new Date().toISOString(),
    source: "fmp",
  };
}

/** Merge FMP `stable/ratios-ttm` valuation/quality ratios into a fundamentals row. Exported for tests. */
export function applyFmpRatios(base: NormalizedFundamentals, raw: unknown): NormalizedFundamentals {
  const r = firstRow(raw);
  return {
    ...base,
    pe: base.pe ?? pickNum(r, ["priceToEarningsRatioTTM", "peRatioTTM"]),
    ps: pickNum(r, ["priceToSalesRatioTTM", "priceToSalesRatioTTM"]),
    pb: pickNum(r, ["priceToBookRatioTTM", "pbRatioTTM"]),
    roe: pickNum(r, ["returnOnEquityTTM"]),
    debtToEquity: pickNum(r, ["debtToEquityRatioTTM", "debtEquityRatioTTM"]),
    netMargin: pickNum(r, ["netProfitMarginTTM"]),
  };
}

// ---------- Stock screener (FMP) — discovery of NEW ideas to research ----------
export interface ScreenedStock {
  ticker: string;
  name: string;
  sector: string | null;
  marketCap: number | null;
  price: number | null;
  beta: number | null;
  assetType: "STOCK" | "ETF";
}

export interface ScreenCriteria {
  marketCapMoreThan?: number;
  marketCapLowerThan?: number;
  betaLowerThan?: number;
  betaMoreThan?: number;
  dividendMoreThan?: number;
  priceMoreThan?: number;
  isEtf?: boolean;
  limit?: number;
}

/** Parse an FMP `stable/company-screener` array response. Exported for tests. */
export function parseFmpScreener(raw: unknown): ScreenedStock[] {
  if (!Array.isArray(raw)) return [];
  const out: ScreenedStock[] = [];
  for (const item of raw) {
    const r = (item ?? {}) as Record<string, unknown>;
    const ticker = typeof r.symbol === "string" ? r.symbol.toUpperCase() : null;
    if (!ticker) continue;
    out.push({
      ticker,
      name: typeof r.companyName === "string" && r.companyName ? r.companyName : ticker,
      sector: typeof r.sector === "string" && r.sector ? r.sector : null,
      marketCap: num(r.marketCap),
      price: num(r.price),
      beta: num(r.beta),
      assetType: r.isEtf === true ? "ETF" : "STOCK",
    });
  }
  return out;
}

/**
 * Run the FMP company screener. Returns REAL listed stocks matching the criteria
 * (US, actively trading) — discovery candidates to research, never AI signals.
 * Best-effort: an empty/failed response yields an empty list, never fabrication.
 */
export async function fetchFmpScreener(opts: {
  apiKey: string;
  baseUrl?: string;
  criteria: ScreenCriteria;
}): Promise<ScreenedStock[]> {
  const base = opts.baseUrl ?? "https://financialmodelingprep.com";
  const c = opts.criteria;
  const params = new URLSearchParams({
    country: "US",
    isActivelyTrading: "true",
    isFund: "false",
    limit: String(c.limit ?? 10),
    apikey: opts.apiKey,
  });
  if (c.marketCapMoreThan != null) params.set("marketCapMoreThan", String(c.marketCapMoreThan));
  if (c.marketCapLowerThan != null) params.set("marketCapLowerThan", String(c.marketCapLowerThan));
  if (c.betaLowerThan != null) params.set("betaLowerThan", String(c.betaLowerThan));
  if (c.betaMoreThan != null) params.set("betaMoreThan", String(c.betaMoreThan));
  if (c.dividendMoreThan != null) params.set("dividendMoreThan", String(c.dividendMoreThan));
  if (c.priceMoreThan != null) params.set("priceMoreThan", String(c.priceMoreThan));
  if (c.isEtf != null) params.set("isEtf", String(c.isEtf));
  const raw = await fetchJson<unknown>("fmp", `${base}/stable/company-screener?${params.toString()}`);
  return parseFmpScreener(raw);
}

/** Merge FMP analyst price-target + rating consensus. Exported for tests. */
export function applyFmpAnalyst(
  base: NormalizedFundamentals,
  targetRaw: unknown,
  gradesRaw: unknown,
): NormalizedFundamentals {
  const t = firstRow(targetRaw);
  const g = firstRow(gradesRaw);
  const consensus = g["consensus"];
  return {
    ...base,
    priceTargetAvg: pickNum(t, [
      "lastQuarterAvgPriceTarget",
      "lastMonthAvgPriceTarget",
      "allTimeAvgPriceTarget",
    ]),
    analystConsensus: typeof consensus === "string" && consensus ? consensus : null,
  };
}

/**
 * Financial Modeling Prep fundamentals. Uses the current "stable" company
 * profile endpoint (market cap, beta, sector). A profile with no usable fields
 * is treated as "no data" so the caller's evidence bundle stays honest.
 */
export class FmpProvider implements FundamentalsProvider {
  readonly name = "fmp";
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://financialmodelingprep.com",
  ) {}

  private url(path: string, ticker: string): string {
    const t = encodeURIComponent(ticker.toUpperCase());
    return `${this.baseUrl}/stable/${path}?symbol=${t}&apikey=${encodeURIComponent(this.apiKey)}`;
  }

  async getFundamentals(ticker: string): Promise<NormalizedFundamentals> {
    const raw = await fetchJson<unknown>("fmp", this.url("profile", ticker));
    let parsed = parseFmpProfile(ticker, raw);
    // If the provider returned a row but nothing usable, surface as upstream "no data".
    if (parsed.marketCap === null && parsed.sector === null && parsed.beta === null && parsed.price === null) {
      throw new UpstreamError("fmp", `No fundamentals for ${ticker}`);
    }

    // Enrich with ratios + analyst context — all best-effort, so a missing or
    // changed endpoint never drops the core profile (and never fabricates data).
    const [ratios, target, grades] = await Promise.allSettled([
      fetchJson<unknown>("fmp", this.url("ratios-ttm", ticker)),
      fetchJson<unknown>("fmp", this.url("price-target-summary", ticker)),
      fetchJson<unknown>("fmp", this.url("grades-consensus", ticker)),
    ]);
    if (ratios.status === "fulfilled") parsed = applyFmpRatios(parsed, ratios.value);
    if (target.status === "fulfilled" || grades.status === "fulfilled") {
      parsed = applyFmpAnalyst(
        parsed,
        target.status === "fulfilled" ? target.value : null,
        grades.status === "fulfilled" ? grades.value : null,
      );
    }
    return parsed;
  }
}
