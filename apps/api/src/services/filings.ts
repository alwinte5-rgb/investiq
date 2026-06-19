import {
  InMemoryTtlCache,
  edgarCompanyUrl,
  fetchSecCompanyTickers,
  fetchSecFilings,
  type CompanyFiling,
  type SecCompany,
} from "@investiq/integrations";

/**
 * Filings service (SEC EDGAR). Resolves a ticker to its CIK via the cached SEC
 * directory, then returns the latest 10-K/10-Q links. Educational primary-source
 * material — read-only, non-personalized, free. Returns null for tickers EDGAR
 * doesn't list as a filer (e.g. many ETFs).
 */
const TICKERS_TTL_MS = 24 * 60 * 60 * 1000; // the directory changes rarely
const FILINGS_TTL_MS = 12 * 60 * 60 * 1000;

export interface CompanyFilings {
  ticker: string;
  cik: string;
  name: string;
  edgarUrl: string;
  filings: CompanyFiling[];
}

export interface FilingsService {
  getFilings(ticker: string): Promise<CompanyFilings | null>;
  readonly enabled: boolean;
}

export function createFilingsService(opts: { userAgent: string }): FilingsService {
  const cache = new InMemoryTtlCache();

  async function tickerMap(): Promise<Map<string, SecCompany>> {
    const cached = cache.get<Map<string, SecCompany>>("sec:tickers");
    if (cached) return cached;
    const list = await fetchSecCompanyTickers(opts.userAgent);
    const map = new Map<string, SecCompany>();
    for (const c of list) if (!map.has(c.ticker)) map.set(c.ticker, c);
    if (map.size > 0) cache.set("sec:tickers", map, TICKERS_TTL_MS);
    return map;
  }

  async function getFilings(ticker: string): Promise<CompanyFilings | null> {
    const T = ticker.toUpperCase();
    const key = `sec:filings:${T}`;
    const cached = cache.get<CompanyFilings>(key);
    if (cached) return cached;

    const company = (await tickerMap()).get(T);
    if (!company) return null;

    const filings = await fetchSecFilings(company.cik, opts.userAgent);
    const result: CompanyFilings = {
      ticker: T,
      cik: company.cik,
      name: company.name,
      edgarUrl: edgarCompanyUrl(company.cik),
      filings,
    };
    cache.set(key, result, FILINGS_TTL_MS);
    return result;
  }

  return { getFilings, enabled: true };
}
