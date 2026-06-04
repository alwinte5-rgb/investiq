"use client";

import { useEffect, useState } from "react";
import {
  getPortfolioRiskAction,
  type PortfolioRiskView,
} from "@/app/(authed)/portfolio/actions";

const DOT: Record<string, string> = {
  GREEN: "bg-green-500",
  YELLOW: "bg-amber-500",
  ORANGE: "bg-orange-500",
  RED: "bg-red-500",
};
const TONE: Record<string, string> = {
  GREEN: "bg-green-100 text-green-800 border-green-200",
  YELLOW: "bg-amber-100 text-amber-800 border-amber-200",
  ORANGE: "bg-orange-100 text-orange-800 border-orange-200",
  RED: "bg-red-100 text-red-800 border-red-200",
};
const LABEL: Record<string, string> = {
  GREEN: "Low risk",
  YELLOW: "Watch",
  ORANGE: "Elevated",
  RED: "High risk",
};

export function PortfolioRiskPanel() {
  const [risk, setRisk] = useState<PortfolioRiskView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await getPortfolioRiskAction();
      if (!active) return;
      if (res.ok) setRisk(res.result);
      else setError(res.error);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <p className="text-sm text-neutral-500">Loading portfolio risk…</p>;
  if (error || !risk) return null; // non-critical panel — stay quiet on error
  if (risk.status === "insufficient") return null; // covered by the analysis empty state

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Portfolio risk</h2>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${TONE[risk.overallColor]}`}
        >
          {LABEL[risk.overallColor]}
        </span>
      </div>
      <ul className="divide-y rounded-lg border">
        {risk.holdings.map((h) => (
          <li key={h.ticker} className="space-y-1 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${DOT[h.warningColor]}`} />
                <span className="font-medium">{h.ticker}</span>
                <span className="text-neutral-400">{h.weightPct}%</span>
              </span>
              <span className="text-xs text-neutral-500">{LABEL[h.warningColor]}</span>
            </div>
            {h.warnings.length > 0 && (
              <ul className="pl-4 text-xs text-neutral-600">
                {h.warnings.map((w, i) => (
                  <li key={i}>
                    {w.severity === "warn" ? "⚠ " : "• "}
                    {w.message}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-neutral-400">
        Per-holding risk from concentration, upcoming earnings, and recent news — educational only.
      </p>
    </div>
  );
}
