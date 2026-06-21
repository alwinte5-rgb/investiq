"use client";

import { useEffect, useState, useTransition } from "react";
import { getScorecardAction, type Scorecard } from "@/app/(authed)/research/actions";

const pct = (n: number | null | undefined) =>
  n == null ? "—" : `${(n * 100).toFixed(1)}%`;

function strengthTone(v: number): string {
  return v >= 80
    ? "text-emerald-600"
    : v >= 60
      ? "text-blue-600"
      : v >= 40
        ? "text-amber-600"
        : "text-red-600";
}
function strengthLabel(v: number): string {
  return v >= 80 ? "Excellent" : v >= 60 ? "Good" : v >= 40 ? "Fair" : "Weak";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-400">{label}</div>
      <div className="font-semibold text-slate-700">{value}</div>
    </div>
  );
}

/**
 * One-card stock scorecard — deterministic Financial Strength + the key
 * fundamentals behind it. Self-hides when fundamentals aren't available so it
 * never shows an empty shell. Educational, factual (no AI), non-advisory.
 */
export function StockScorecard({ ticker }: { ticker: string }) {
  const [card, setCard] = useState<Scorecard | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [, start] = useTransition();

  useEffect(() => {
    setLoaded(false);
    start(async () => {
      const res = await getScorecardAction(ticker);
      setCard(res.ok ? res.scorecard : null);
      setLoaded(true);
    });
  }, [ticker]);

  // Nothing useful to show (fundamentals unavailable / not configured) → hide.
  if (loaded && (!card || (card.financialStrength == null && card.pe == null && card.roe == null))) {
    return null;
  }

  const fs = card?.financialStrength ?? null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Financial strength</div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${fs != null ? strengthTone(fs) : "text-slate-400"}`}>
              {fs ?? "—"}
            </span>
            {fs != null && (
              <span className="text-sm text-slate-400">/100 · {strengthLabel(fs)}</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
          <Stat label="P/E" value={card?.pe != null ? card.pe.toFixed(1) : "—"} />
          <Stat label="ROE" value={pct(card?.roe)} />
          <Stat label="Net margin" value={pct(card?.netMargin)} />
          <Stat label="Debt/Eq" value={card?.debtToEquity != null ? card.debtToEquity.toFixed(2) : "—"} />
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Heuristic from public fundamentals — educational, not advice.
      </p>
    </div>
  );
}
