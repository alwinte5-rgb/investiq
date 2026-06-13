"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { assessRiskAction, type RiskView } from "@/app/(authed)/research/actions";
import { LearnPanel } from "@/components/learn-ui";
import { Term } from "@/components/term";

const COLOR_TONE: Record<string, string> = {
  GREEN: "bg-green-100 text-green-800 border-green-200",
  YELLOW: "bg-amber-100 text-amber-800 border-amber-200",
  ORANGE: "bg-orange-100 text-orange-800 border-orange-200",
  RED: "bg-red-100 text-red-800 border-red-200",
};
const COLOR_LABEL: Record<string, string> = {
  GREEN: "Low risk",
  YELLOW: "Watch",
  ORANGE: "Elevated risk",
  RED: "High risk",
};

const money = (v: number | null | undefined) =>
  v == null ? "—" : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function Stat({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-sm font-semibold text-neutral-800">{value}</div>
    </div>
  );
}

export function RiskPanel({ ticker }: { ticker: string }) {
  const [risk, setRisk] = useState<RiskView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function assess() {
    setError(null);
    start(async () => {
      const res = await assessRiskAction(ticker);
      if (res.ok) setRisk(res.result);
      else {
        setError(res.error);
        setRisk(null);
      }
    });
  }

  // Auto-assess when a stock is accessed — analysis, risk, and news all run
  // together. Re-running for the same ticker is intentional (fresh price).
  useEffect(() => {
    assess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Risk & levels</h3>
        <button
          onClick={assess}
          disabled={pending}
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          {pending ? "Assessing…" : risk ? "Re-assess" : "Assess risk"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {!risk ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-neutral-500">
          Get buy zone, stop, target, and position sizing for {ticker}.
        </p>
      ) : risk.status === "insufficient" ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {risk.message ?? "Not enough data to assess risk."}
        </p>
      ) : (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                COLOR_TONE[risk.warningColor ?? "GREEN"]
              }`}
            >
              {COLOR_LABEL[risk.warningColor ?? "GREEN"]}
            </span>
            <span className="text-xs text-neutral-400">Last price {money(risk.price)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label={<Term k="buy zone">Buy zone</Term>}
              value={`${money(risk.buyZoneLow)} – ${money(risk.buyZoneHigh)}`}
            />
            <Stat label={<Term k="stop loss">Stop loss</Term>} value={money(risk.stopLoss)} />
            <Stat label={<Term k="profit target">Profit target</Term>} value={money(risk.profitTarget)} />
            <Stat
              label={<Term k="reward : risk">Reward : risk</Term>}
              value={risk.riskReward != null ? `${risk.riskReward}:1` : "—"}
            />
            <Stat
              label={<Term k="position sizing">Suggested size</Term>}
              value={risk.positionSize != null ? `${risk.positionSize} sh` : "—"}
            />
            <Stat
              label={
                <>
                  <Term k="max risk">Max risk</Term> ({risk.maxRiskPct ?? 1}%)
                </>
              }
              value={money(risk.maxRiskAmount)}
            />
          </div>

          {risk.warnings && risk.warnings.length > 0 && (
            <ul className="space-y-1 border-t pt-2 text-xs">
              {risk.warnings.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <span className={w.severity === "warn" ? "text-amber-600" : "text-neutral-400"}>
                    {w.severity === "warn" ? "⚠" : "•"}
                  </span>
                  <span className="text-neutral-600">{w.message}</span>
                </li>
              ))}
            </ul>
          )}

          <LearnPanel kind="risk" />

          <p className="border-t pt-2 text-[11px] text-neutral-400">
            Educational levels derived from price + volatility — not a trade instruction. Position
            sizing assumes risking {risk.maxRiskPct ?? 1}% of your portfolio per trade.
          </p>
        </div>
      )}
    </div>
  );
}
