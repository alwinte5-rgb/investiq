"use client";

import { useEffect, useState, useTransition } from "react";
import { getFilingsAction, type CompanyFilings } from "@/app/(authed)/research/actions";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Primary-source SEC filings (EDGAR) for the analyzed ticker. Educational: the
 * best way to learn is to read the company's own 10-K/10-Q. Self-hides when the
 * ticker isn't an EDGAR filer (e.g. many ETFs) so it never shows an empty box.
 */
export function FilingsPanel({ ticker }: { ticker: string }) {
  const [filings, setFilings] = useState<CompanyFilings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    setError(null);
    setLoaded(false);
    start(async () => {
      const res = await getFilingsAction(ticker);
      if (res.ok) setFilings(res.filings);
      else setError(res.error);
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  // Quietly render nothing when there's nothing useful (non-filer / no filings).
  if (loaded && !error && (!filings || filings.filings.length === 0)) return null;

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-lg font-semibold">Primary sources — SEC filings</h3>
        <p className="text-sm text-slate-500">
          The company&apos;s official reports, straight from the SEC. Reading the real thing is the
          best way to learn how a business actually works.
        </p>
      </div>

      {pending && !filings ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-slate-500">
          Loading filings…
        </p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : filings ? (
        <div className="space-y-2 rounded-lg border p-4">
          <ul className="divide-y">
            {filings.filings.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-baseline gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {f.form}
                  </span>
                  <span className="text-xs text-slate-500">filed {fmtDate(f.filingDate)}</span>
                </span>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm font-medium text-blue-600 hover:underline"
                >
                  Read ↗
                </a>
              </li>
            ))}
          </ul>
          <a
            href={filings.edgarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            All filings on SEC EDGAR ↗
          </a>
          <p className="border-t pt-2 text-[11px] text-slate-400">
            10-K = annual report · 10-Q = quarterly report. Source: SEC EDGAR — educational, not
            advice.
          </p>
        </div>
      ) : null}
    </div>
  );
}
