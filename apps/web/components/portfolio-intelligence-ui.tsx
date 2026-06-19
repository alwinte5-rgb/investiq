"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  generatePortfolioAction,
  type SectorWeight,
} from "@/app/(authed)/portfolio/actions";

export interface PortfolioView {
  healthScore: number;
  riskScore: number;
  diversificationScore: number;
  cashScore: number;
  sectorConcentration: SectorWeight[];
  overweight: SectorWeight[];
  underweight: SectorWeight[];
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  generatedAt: string;
  totalValue?: number;
  cashPct?: number;
  holdingsCount?: number;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function healthLabel(v: number): string {
  return v >= 80 ? "Excellent" : v >= 65 ? "Good" : v >= 45 ? "Fair" : "Needs attention";
}
function healthStroke(v: number): string {
  return v >= 80 ? "#10b981" : v >= 65 ? "#3b82f6" : v >= 45 ? "#f59e0b" : "#ef4444";
}

/** Apple-Health-style ring for the overall score. */
function ScoreRing({ value }: { value: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - clamp(value) / 100);
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke={healthStroke(value)}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 70 70)"
      />
      <text x="70" y="68" textAnchor="middle" fontSize="34" fontWeight="700" fill="#0f172a">
        {clamp(value)}
      </text>
      <text x="70" y="90" textAnchor="middle" fontSize="11" fill="#94a3b8">
        / 100
      </text>
    </svg>
  );
}

/** One labelled progress bar. `invert` (risk): low value is good. */
function MetricBar({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const v = clamp(value);
  const good = invert ? v <= 40 : v >= 60;
  const mid = invert ? v > 40 && v <= 60 : v >= 40 && v < 60;
  const color = good ? "bg-emerald-500" : mid ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-semibold text-slate-800">
          {v}
          <span className="text-slate-400">/100</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

function SectorBars({ sectors }: { sectors: SectorWeight[] }) {
  if (sectors.length === 0) return <p className="text-xs text-slate-500">No sector data.</p>;
  return (
    <ul className="space-y-2">
      {sectors.map((s) => (
        <li key={s.sector}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-slate-600">{s.sector}</span>
            <span className="font-medium text-slate-800">{Math.round(s.pct)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-blue-500"
              style={{ width: `${Math.max(0, Math.min(100, s.pct))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Narrative({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className={`mb-1 text-sm font-semibold ${tone}`}>{title}</h4>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function Report({ v }: { v: PortfolioView }) {
  return (
    <div className="space-y-4">
      {/* Health hero: ring + breakdown bars */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center">
            <ScoreRing value={v.healthScore} />
            <div className="mt-1 text-sm font-semibold text-slate-700">
              {healthLabel(v.healthScore)}
            </div>
            <div className="text-[11px] text-slate-400">Portfolio health</div>
          </div>
          <div className="w-full flex-1 space-y-3">
            <MetricBar label="Diversification" value={v.diversificationScore} />
            <MetricBar label="Risk" value={v.riskScore} invert />
            <MetricBar label="Cash buffer" value={v.cashScore} />
          </div>
        </div>
        <p className="mt-4 border-t pt-3 text-[11px] text-slate-400">
          {new Date(v.generatedAt).toLocaleString()}
          {v.holdingsCount != null ? ` · ${v.holdingsCount} holdings` : ""} · Deterministic scoring
          from your holdings — educational only, not investment advice.
        </p>
      </div>

      {/* Recommendations — the "what to focus on" block */}
      {v.improvements.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Recommendations</h3>
          <ul className="space-y-2">
            {v.improvements.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-0.5 text-emerald-500">✓</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Strengths + weaknesses */}
      {(v.strengths.length > 0 || v.weaknesses.length > 0) && (
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <Narrative title="Strengths" items={v.strengths} tone="text-emerald-700" />
          <Narrative title="Watch-outs" items={v.weaknesses} tone="text-red-700" />
        </div>
      )}

      {/* Sector mix */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Sector mix</h3>
        <SectorBars sectors={v.sectorConcentration} />
        {(v.overweight.length > 0 || v.underweight.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-xs">
            {v.overweight.length > 0 && (
              <div>
                <span className="text-slate-500">Overweight: </span>
                {v.overweight.map((s) => (
                  <span
                    key={s.sector}
                    className="mr-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700"
                  >
                    {s.sector} {Math.round(s.pct)}%
                  </span>
                ))}
              </div>
            )}
            {v.underweight.length > 0 && (
              <div>
                <span className="text-slate-500">Underweight: </span>
                {v.underweight.map((s) => (
                  <span
                    key={s.sector}
                    className="mr-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700"
                  >
                    {s.sector} {Math.round(s.pct)}%
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function PortfolioIntelligenceUI({
  initial,
  gated,
}: {
  initial: PortfolioView | null;
  gated: boolean;
}) {
  const [view, setView] = useState<PortfolioView | null>(initial);
  const [insufficient, setInsufficient] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGated, setIsGated] = useState(gated);
  const [pending, start] = useTransition();

  function refresh() {
    setError(null);
    setInsufficient(null);
    start(async () => {
      const res = await generatePortfolioAction();
      if (res.ok) {
        if (res.result.status === "scored") {
          setView(res.result.analysis);
          setInsufficient(null);
        } else {
          setInsufficient(res.result.message);
        }
      } else if (res.gated) {
        setIsGated(true);
      } else {
        setError(res.error);
      }
    });
  }

  if (isGated) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-800">
        <p className="mb-2 font-medium">Portfolio health is an Investor feature.</p>
        <p className="mb-3">
          Upgrade to get your health score, risk, diversification and cash buffer plus sector mix and
          focus recommendations for your portfolio.
        </p>
        <Link
          href="/pricing"
          className="inline-block rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
        >
          See plans
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {view ? "Latest health report for your connected holdings." : "No report yet."}
        </p>
        <button
          onClick={refresh}
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Analyzing…" : view ? "Refresh" : "Generate report"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}
      {insufficient && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {insufficient} Connect a brokerage and sync your holdings, or try sample data.
        </div>
      )}

      {view ? (
        <Report v={view} />
      ) : (
        !insufficient && (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
            Generate a report to see your portfolio health, risk and diversification.
          </div>
        )
      )}
    </div>
  );
}
