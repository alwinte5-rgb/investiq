"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  generateOpportunitiesAction,
  type Opportunity,
  type OpportunityGroup,
  type OpportunityType,
} from "@/app/(authed)/opportunities/actions";

const SECTION_TONE: Record<OpportunityType, string> = {
  BUY_WATCH: "border-green-200",
  ETF: "border-emerald-200",
  REBUY: "border-teal-200",
  REVIEW: "border-amber-200",
  HIGH_RISK_HOLDING: "border-orange-200",
  AVOID: "border-red-200",
  WATCHING: "border-neutral-200",
};
const COLOR_DOT: Record<string, string> = {
  GREEN: "#15803d",
  YELLOW: "#b45309",
  ORANGE: "#c2410c",
  RED: "#b91c1c",
};

function OpportunityRow({ o }: { o: Opportunity }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/research?ticker=${o.ticker}`}
            className="font-medium text-blue-600 hover:underline"
            title={`Research ${o.ticker}`}
          >
            {o.ticker}
          </Link>
          <span className="truncate text-xs text-neutral-500">{o.name}</span>
          {o.supporting.held && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
              Held
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-neutral-600">{o.explanation}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        <span className="text-sm font-semibold text-neutral-800">{o.score}</span>
        <span className="flex items-center gap-1 text-[11px] text-neutral-400">
          {o.supporting.warningColor && (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: COLOR_DOT[o.supporting.warningColor] }}
            />
          )}
          C{o.confidence}/R{o.risk}
        </span>
      </div>
    </li>
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
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
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
        <p className="text-sm text-neutral-500">
          {total > 0 ? `${total} opportunities across ${groups.length} categories.` : "No opportunities yet."}
        </p>
        <button
          onClick={refresh}
          disabled={pending}
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          {pending ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {total === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-neutral-500">
          Nothing analyzed yet. Every stock you analyze shows up here — buy/ETF/rebuy watches,
          high-risk holdings, positions to review, and a neutral{" "}
          <span className="font-medium">Watching</span> list for steady Holds. Pick any of the{" "}
          <span className="font-medium">Ideas to research</span> below to get started.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <section key={g.type} className={`rounded-lg border p-4 ${SECTION_TONE[g.type]}`}>
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{g.label}</h2>
                <span className="text-xs text-neutral-400">{g.items.length}</span>
              </div>
              <ul className="divide-y">
                {g.items.map((o) => (
                  <OpportunityRow key={o.ticker} o={o} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="text-[11px] text-neutral-400">
        Ranked from your stored analyses, risk assessments and news — educational “Watch” signals,
        not buy/sell advice.
      </p>
    </div>
  );
}
