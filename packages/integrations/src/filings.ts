import { fetchJson } from "./http.js";

/**
 * SEC EDGAR — free, official primary-source filings. Used for EDUCATION: link
 * users from an analysis to the company's real 10-K / 10-Q so they can learn to
 * read primary sources. No API key required, but the SEC mandates a descriptive
 * User-Agent with contact info on every request.
 */
export interface CompanyFiling {
  form: string; // "10-K" | "10-Q"
  filingDate: string; // ISO date
  url: string; // direct link to the filing's primary document
}

export interface SecCompany {
  cik: string; // 10-digit zero-padded
  ticker: string; // uppercased
  name: string;
}

interface SecTickerRow {
  cik_str: number;
  ticker: string;
  title: string;
}

interface SecSubmissions {
  name?: string;
  filings?: {
    recent?: {
      form?: string[];
      filingDate?: string[];
      accessionNumber?: string[];
      primaryDocument?: string[];
    };
  };
}

/** The full ticker → CIK directory. Large (~1MB) — callers should cache it. */
export async function fetchSecCompanyTickers(userAgent: string): Promise<SecCompany[]> {
  const json = await fetchJson<Record<string, SecTickerRow>>(
    "sec",
    "https://www.sec.gov/files/company_tickers.json",
    { headers: { "User-Agent": userAgent }, timeoutMs: 15000 },
  );
  return Object.values(json).map((r) => ({
    cik: String(r.cik_str).padStart(10, "0"),
    ticker: r.ticker.toUpperCase(),
    name: r.title,
  }));
}

/** Latest 10-K/10-Q filings for a company (by zero-padded CIK), newest first. */
export async function fetchSecFilings(
  cik: string,
  userAgent: string,
  forms: string[] = ["10-K", "10-Q"],
  limit = 4,
): Promise<CompanyFiling[]> {
  const json = await fetchJson<SecSubmissions>(
    "sec",
    `https://data.sec.gov/submissions/CIK${cik}.json`,
    { headers: { "User-Agent": userAgent }, timeoutMs: 15000 },
  );
  const r = json.filings?.recent;
  if (!r?.form) return [];
  const cikNum = String(Number(cik)); // un-padded for the Archives path
  const out: CompanyFiling[] = [];
  for (let i = 0; i < r.form.length && out.length < limit; i++) {
    const form = r.form[i];
    if (!form || !forms.includes(form)) continue;
    const acc = r.accessionNumber?.[i]?.replace(/-/g, "");
    const doc = r.primaryDocument?.[i];
    const date = r.filingDate?.[i];
    if (!acc || !doc || !date) continue;
    out.push({ form, filingDate: date, url: `https://www.sec.gov/Archives/edgar/data/${cikNum}/${acc}/${doc}` });
  }
  return out;
}

/** The EDGAR landing page for a company's filing history. */
export function edgarCompanyUrl(cik: string): string {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K&dateb=&owner=include&count=40`;
}
