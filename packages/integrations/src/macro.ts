import { fetchJson } from "./http.js";

/**
 * FRED (Federal Reserve Bank of St. Louis) — free macro indicators. Used purely
 * for EDUCATION: a "macro context" panel that ties the macro glossary terms
 * (inflation, interest rates, recession) to live numbers. Non-advisory and
 * non-personalized — the same figures for everyone.
 */
export interface MacroIndicator {
  id: string; // FRED series id
  label: string; // friendly label
  value: number | null; // latest observation (null when unavailable)
  unit: string; // e.g. "%"
  asOf: string | null; // observation date (ISO)
  blurb: string; // one-line plain-English explainer
}

interface FredObservation {
  date: string;
  value: string; // FRED returns "." for missing
}
interface FredResponse {
  observations?: FredObservation[];
}

/** The curated series shown in the macro panel. `units: "pc1"` = % change YoY. */
const SERIES: { id: string; label: string; unit: string; units?: string; blurb: string }[] = [
  { id: "FEDFUNDS", label: "Fed Funds Rate", unit: "%", blurb: "The Federal Reserve's benchmark rate — higher rates tend to pressure stock valuations." },
  { id: "CPIAUCSL", label: "Inflation (CPI, YoY)", unit: "%", units: "pc1", blurb: "How fast consumer prices are rising versus a year ago." },
  { id: "DGS10", label: "10-Year Treasury", unit: "%", blurb: "The yield on 10-year US government debt — a key 'risk-free' benchmark." },
  { id: "UNRATE", label: "Unemployment", unit: "%", blurb: "Share of the labor force without a job — a gauge of economic health." },
  { id: "GDPC1", label: "Real GDP (YoY)", unit: "%", units: "pc1", blurb: "Inflation-adjusted growth of the US economy versus a year ago." },
];

async function fetchOne(
  apiKey: string,
  baseUrl: string,
  s: (typeof SERIES)[number],
): Promise<MacroIndicator> {
  try {
    const params = new URLSearchParams({
      series_id: s.id,
      api_key: apiKey,
      file_type: "json",
      sort_order: "desc",
      limit: "1",
    });
    if (s.units) params.set("units", s.units);
    const json = await fetchJson<FredResponse>("fred", `${baseUrl}/series/observations?${params.toString()}`);
    const obs = json.observations?.[0];
    const n = obs && obs.value !== "." ? Number(obs.value) : NaN;
    return {
      id: s.id,
      label: s.label,
      value: Number.isFinite(n) ? Math.round(n * 100) / 100 : null,
      unit: s.unit,
      asOf: obs?.date ?? null,
      blurb: s.blurb,
    };
  } catch {
    // Best-effort: a single series failing must not blank the whole panel.
    return { id: s.id, label: s.label, value: null, unit: s.unit, asOf: null, blurb: s.blurb };
  }
}

/** Fetch the latest value for each curated series (parallel, best-effort). */
export async function fetchFredLatest(
  apiKey: string,
  baseUrl = "https://api.stlouisfed.org/fred",
): Promise<MacroIndicator[]> {
  return Promise.all(SERIES.map((s) => fetchOne(apiKey, baseUrl, s)));
}
