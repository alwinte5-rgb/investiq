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

function ScoreTile({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  // For risk, lower is better → invert the color scale.
  const good = invert ? value <= 40 : value >= 60;
  const mid = value > 40 && value < 60;
  const tone = good ? "text-green-600" : mid ? "text-amber-600" : "text-red-600";
  return (
    <div className="rounded-md border p-3 text-center">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
      <div className="text-[10px] text-neutral-400">/ 100</div>
    </div>
  );
}

function SectorBars({ sectors }: { sectors: SectorWeight[] }) {
  if (sectors.length === 0) return <p className="text-xs text-neutral-500">No sector data.</p>;
  return (
    <ul className="space-y-2">
      {sectors.map((s) => (
        <li key={s.sector}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-neutral-700">{s.sector}</span>
            <span className="font-medium">{Math.round(s.pct)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-neutral-100">
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
      <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function Report({ v }: { v: PortfolioView }) {
  return (
    <div className="space-y-5 rounded-lg border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Portfolio health</h3>
        <span className="text-xs text-neutral-400">
          {new Date(v.generatedAt).toLocaleString()}
          {v.holdingsCount != null ? ` · ${v.holdingsCount} holdings` : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ScoreTile label="Health" value={v.healthScore} />
        <ScoreTile label="Diversification" value={v.diversificationScore} />
        <ScoreTile label="Risk" value={v.riskScore} invert />
        <ScoreTile label="Cash" value={v.cashScore} />
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold">Sector concentration</h4>
        <SectorBars sectors={v.sectorConcentration} />
      </div>

      {(v.overweight.length > 0 || v.underweight.length > 0) && (
        <div className="flex flex-wrap gap-4 text-xs">
          {v.overweight.length > 0 && (
            <div>
              <span className="text-neutral-500">Overweight: </span>
              {v.overweight.map((s) => (
                <span key={s.sector} className="mr-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                  {s.sector} {Math.round(s.pct)}%
                </span>
              ))}
            </div>
          )}
          {v.underweight.length > 0 && (
            <div>
              <span className="text-neutral-500">Underweight: </span>
              {v.underweight.map((s) => (
                <span key={s.sector} className="mr-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                  {s.sector} {Math.round(s.pct)}%
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Narrative title="Strengths" items={v.strengths} tone="text-green-700" />
        <Narrative title="Weaknesses" items={v.weaknesses} tone="text-red-700" />
        <Narrative title="Suggested focus" items={v.improvements} tone="text-blue-700" />
      </div>

      <p className="border-t pt-3 text-[11px] text-neutral-400">
        Deterministic scoring from your stored holdings — educational only, not investment advice.
      </p>
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
      <div className="rounded-md border border-blue-200 bg-blue-50 p-5 text-sm text-blue-800">
        <p className="mb-2 font-medium">Portfolio Intelligence is an Investor feature.</p>
        <p className="mb-3">
          Upgrade to get health, risk, diversification and cash scores plus sector concentration and
          suggested focus areas for your portfolio.
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
        <p className="text-sm text-neutral-500">
          {view ? "Latest analysis of your connected holdings." : "No analysis yet."}
        </p>
        <button
          onClick={refresh}
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Analyzing…" : view ? "Refresh analysis" : "Generate analysis"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}
      {insufficient && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {insufficient} Connect a brokerage and sync at least 3 holdings to see a full analysis.
        </div>
      )}

      {view ? (
        <Report v={view} />
      ) : (
        !insufficient && (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-neutral-500">
            Generate an analysis to see your portfolio health, risk and diversification.
          </div>
        )
      )}
    </div>
  );
}
