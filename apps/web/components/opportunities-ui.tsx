"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  generateOpportunitiesAction,
  type Opportunity,
  type OpportunityGroup,
  type OpportunityType,
} from "@/app/(authed)/opportunities/actions";

// Watch-framed verdicts (NON-ADVISORY — never Buy/Sell) + sparing accent tones.
type Tone = "green" | "amber" | "red" | "slate";
const VERDICT: Record<OpportunityType, { label: string; tone: Tone }> = {
  BUY_WATCH: { label: "Buy Watch", tone: "green" },
  ETF: { label: "ETF Watch", tone: "green" },
  REBUY: { label: "Rebuy Watch", tone: "green" },
  REVIEW: { label: "Review", tone: "amber" },
  HIGH_RISK_HOLDING: { label: "High-Risk Holding", tone: "red" },
  AVOID: { label: "Avoid", tone: "red" },
  WATCHING: { label: "Watching", tone: "slate" },
};
// Feed order: warnings first, then conviction watches, neutral Holds last.
const PRIORITY: Record<OpportunityType, number> = {
  HIGH_RISK_HOLDING: 0,
  REVIEW: 1,
  AVOID: 2,
  BUY_WATCH: 3,
  ETF: 3,
  REBUY: 4,
  WATCHING: 5,
};
const BADGE: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};
const SCORE_TEXT: Record<Tone, string> = {
  green: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
  slate: "text-slate-900",
};

function riskLabel(r: number): string {
  return r < 34 ? "Low" : r < 67 ? "Medium" : "High";
}

function OpportunityCard({ o }: { o: Opportunity }) {
  const v = VERDICT[o.type];
  const news = o.supporting.newsTone;
  return (
    <Link
      href={`/research?ticker=${o.ticker}`}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
      title={`Research ${o.ticker}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">{o.ticker}</span>
            {o.supporting.held && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                Held
              </span>
            )}
          </div>
          <p className="truncate text-xs text-slate-500">{o.name}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${BADGE[v.tone]}`}
        >
          {v.label}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Opportunity</div>
          <div className={`text-3xl font-bold ${SCORE_TEXT[v.tone]}`}>{o.score}</div>
        </div>
        <div className="flex gap-4 text-right text-xs">
          <div>
            <div className="text-slate-400">Confidence</div>
            <div className="font-semibold text-slate-700">{o.confidence}%</div>
          </div>
          <div>
            <div className="text-slate-400">Risk</div>
            <div className="font-semibold text-slate-700">{riskLabel(o.risk)}</div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-600">{o.explanation}</p>

      {news && (
        <div className="mt-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              news === "POSITIVE"
                ? "bg-emerald-50 text-emerald-700"
                : news === "NEGATIVE"
                  ? "bg-red-50 text-red-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            News: {news.toLowerCase()}
          </span>
        </div>
      )}

      <div className="mt-3 text-xs font-medium text-blue-600 group-hover:underline">
        Open analysis →
      </div>
    </Link>
  );
}

/** Flat, ranked card feed — used by both Market watches and personal lists. */
function OpportunityFeed({ groups }: { groups: OpportunityGroup[] }) {
  const items = groups
    .flatMap((g) => g.items)
    .sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type] || b.score - a.score);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((o) => (
        <OpportunityCard key={`${o.type}:${o.ticker}`} o={o} />
      ))}
    </div>
  );
}

/**
 * AI-surfaced MARKET watches — global, non-personalized, the same for everyone.
 * Populated by the scheduled scan, shown even to users with zero analyses of
 * their own. Read-only. Educational "Watch" candidates, never buy/sell advice.
 */
export function MarketWatches({ groups }: { groups: OpportunityGroup[] }) {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Market watches</h2>
        <p className="text-sm text-slate-500">
          AI-surfaced across the market from grounded analysis — the same educational “Watch”
          candidates for everyone. Not buy/sell or personalized advice.
        </p>
      </div>
      {total === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
          The market scan hasn’t produced watches yet — it refreshes on a schedule. Check back soon,
          or analyze any ticker below to build your own list.
        </div>
      ) : (
        <OpportunityFeed groups={groups} />
      )}
    </div>
  );
}

export function OpportunitiesUI({
  initial,
  gated,
}: {
  initial: OpportunityGroup[];
  gated: boolean;
}) {
  const [groups, setGroups] = useState<OpportunityGroup[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isGated, setIsGated] = useState(gated);
  const [pending, start] = useTransition();

  function refresh() {
    setError(null);
    start(async () => {
      const res = await generateOpportunitiesAction();
      if (res.ok) {
        setGroups(res.groups);
        setIsGated(false);
      } else {
        if (res.gated) setIsGated(true);
        else setError(res.error);
      }
    });
  }

  if (isGated) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
        <h2 className="font-semibold text-blue-900">Opportunities is an Investor feature.</h2>
        <p className="mt-1 text-sm text-blue-900/80">
          Upgrade to see ranked buy/ETF/rebuy watches, high-risk holdings, and positions to review —
          each explained from your own analyses.
        </p>
      </div>
    );
  }

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {total > 0 ? `${total} from your analyses` : "Nothing analyzed yet."}
        </p>
        <button
          onClick={refresh}
          disabled={pending}
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          {pending ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {total === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
          Nothing analyzed yet. Every stock you analyze shows up here — buy/ETF/rebuy watches,
          high-risk holdings, positions to review, and a neutral{" "}
          <span className="font-medium">Watching</span> list for steady Holds. Pick any of the{" "}
          <span className="font-medium">Ideas to research</span> below to get started.
        </div>
      ) : (
        <OpportunityFeed groups={groups} />
      )}

      <p className="text-[11px] text-slate-400">
        Ranked from your stored analyses, risk assessments and news — educational “Watch” signals,
        not buy/sell advice.
      </p>
    </div>
  );
}
