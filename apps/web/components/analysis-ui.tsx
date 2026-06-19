"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  generateAnalysisAction,
  type Analysis,
  type AnalysisResult,
} from "@/app/(authed)/research/actions";
import { NewsImpactPanel } from "@/components/news-impact-ui";
import { RiskPanel } from "@/components/risk-ui";
import { ChartPanel } from "@/components/chart-ui";
import { FilingsPanel } from "@/components/filings-ui";
import { LearnPanel } from "@/components/learn-ui";
import { Term } from "@/components/term";

// Display labels for the educational (non-advisory) recommendation types.
const REC_LABELS: Record<string, string> = {
  STRONG_BUY_WATCH: "Strong Buy Watch",
  BUY_WATCH: "Buy Watch",
  HOLD: "Hold",
  TRIM_POSITION: "Trim Position",
  EXIT_CONSIDERATION: "Exit Consideration",
  HIGH_RISK_WARNING: "High Risk Warning",
  AVOID: "Avoid",
  REBUY_WATCH: "Rebuy Watch",
};
const REC_TONE: Record<string, string> = {
  STRONG_BUY_WATCH: "bg-emerald-100 text-emerald-800 border-emerald-200",
  BUY_WATCH: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REBUY_WATCH: "bg-emerald-50 text-emerald-700 border-emerald-200",
  HOLD: "bg-slate-100 text-slate-700 border-slate-200",
  TRIM_POSITION: "bg-amber-50 text-amber-700 border-amber-200",
  EXIT_CONSIDERATION: "bg-orange-50 text-orange-700 border-orange-200",
  HIGH_RISK_WARNING: "bg-red-50 text-red-700 border-red-200",
  AVOID: "bg-red-100 text-red-800 border-red-200",
};

interface SymbolResult {
  ticker: string;
  name: string;
  assetType: "STOCK" | "ETF";
}

function SectionCard({ title, body, accent }: { title: string; body: string | null; accent?: string }) {
  if (!body) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className={`mb-1 text-sm font-semibold ${accent ?? "text-slate-900"}`}>{title}</h4>
      <p className="whitespace-pre-line text-sm text-slate-600">{body}</p>
    </div>
  );
}

/**
 * AI Verdict — the hero. The synthesized takeaway up top, so the conclusion is
 * clear in seconds before any detail. Non-advisory: a "Watch" signal with
 * confidence/risk, explicitly not a buy/sell instruction.
 */
function Verdict({ analysis }: { analysis: Analysis }) {
  const tone =
    REC_TONE[analysis.recommendationType] ?? "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-lg font-bold text-slate-900">
            {analysis.symbol?.ticker ?? ""}{" "}
            <span className="text-sm font-normal text-slate-500">{analysis.symbol?.name}</span>
          </div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            AI verdict · educational signal
          </div>
          <span
            className={`mt-2 inline-block rounded-full border px-3 py-1 text-base font-semibold ${tone}`}
          >
            <Term k={analysis.recommendationType}>
              {REC_LABELS[analysis.recommendationType] ?? analysis.recommendationType}
            </Term>
          </span>
        </div>
        <div className="flex gap-5 text-right">
          <div>
            <div className="text-[11px] text-slate-500">
              <Term k="confidence score">Confidence</Term>
            </div>
            <div className="text-2xl font-bold text-slate-900">{analysis.confidenceScore}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">
              <Term k="risk score">Risk</Term>
            </div>
            <div className="text-2xl font-bold text-slate-900">{analysis.riskScore}</div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        {analysis.model} · {new Date(analysis.generatedAt).toLocaleString()} · A research signal to
        weigh against your own goals, time horizon and risk tolerance — not a buy/sell instruction.
      </p>
    </div>
  );
}

/** "Why" — the top supporting reasons + the synthesized summary, right after the verdict. */
function WhyCard({ analysis }: { analysis: Analysis }) {
  const reasons = analysis.evidence
    .filter((e) => e.role === "SUPPORTING" && e.snapshot?.note)
    .slice(0, 3);
  if (!analysis.summary && reasons.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="mb-2 text-sm font-semibold text-slate-900">Why</h4>
      {reasons.length > 0 && (
        <ul className="mb-3 space-y-1.5 text-sm text-slate-700">
          {reasons.map((e) => (
            <li key={e.id} className="flex gap-2">
              <span className="mt-0.5 text-emerald-600">✓</span>
              <span>{e.snapshot?.note}</span>
            </li>
          ))}
        </ul>
      )}
      {analysis.summary && (
        <p className="whitespace-pre-line text-sm text-slate-600">{analysis.summary}</p>
      )}
    </div>
  );
}

function EvidenceCard({ analysis }: { analysis: Analysis }) {
  if (analysis.evidence.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="mb-2 text-sm font-semibold text-slate-900">
        Evidence ({analysis.evidence.length})
      </h4>
      <ul className="space-y-1 text-xs text-slate-600">
        {analysis.evidence.map((e) => (
          <li key={e.id} className="flex gap-2">
            <span
              className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                e.role === "SUPPORTING"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {e.role === "SUPPORTING" ? "Supports" : "Counters"}
            </span>
            <span>
              <span className="font-medium">{e.sourceType}</span>
              {e.snapshot?.note ? ` — ${e.snapshot.note}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Verdict-first card stack: Verdict → Why → Bull/Bear → risks/technical → news → evidence. */
function AnalysisCard({ analysis }: { analysis: Analysis }) {
  return (
    <div className="space-y-4">
      <Verdict analysis={analysis} />
      <WhyCard analysis={analysis} />

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title="Bull case" body={analysis.bullCase} accent="text-emerald-700" />
        <SectionCard title="Bear case" body={analysis.bearCase} accent="text-red-700" />
      </div>

      <SectionCard title="Key risks" body={analysis.keyRisks} />
      <SectionCard title="Technical read" body={analysis.technicalSummary} />
      <SectionCard title="News impact" body={analysis.newsImpactSummary} />

      <EvidenceCard analysis={analysis} />

      <LearnPanel kind="recommendation" recType={analysis.recommendationType} />

      <p className="border-t pt-3 text-[11px] text-slate-400">
        Educational research only — not investment advice. Every point above is grounded in the
        evidence listed; InvestIQ never issues buy/sell directives.
      </p>
    </div>
  );
}

export function ResearchUI({ initialTicker = "" }: { initialTicker?: string }) {
  const [q, setQ] = useState(initialTicker);
  const [results, setResults] = useState<SymbolResult[]>([]);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzedTicker, setAnalyzedTicker] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  function run(ticker: string) {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setQ(t);
    setOpen(false);
    setResults([]);
    setError(null);
    setAnalyzedTicker(t);
    start(async () => {
      const res = await generateAnalysisAction(t);
      if (res.ok) setResult(res.result);
      else {
        setError(res.error);
        setResult(null);
      }
    });
  }

  // Auto-run when arriving with ?ticker= — and re-run when it changes via
  // same-route navigation (e.g. clicking "Analyze" on a second holding while
  // already on /research). A ref guards against re-running the same ticker.
  const lastAuto = useRef<string | null>(null);
  useEffect(() => {
    const t = initialTicker.trim().toUpperCase();
    if (t && lastAuto.current !== t) {
      lastAuto.current = t;
      run(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTicker]);

  // Debounced typeahead against the BFF search route.
  useEffect(() => {
    const term = q.trim();
    if (!term || !open) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/symbols/search?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        const body = (await res.json()) as { data?: SymbolResult[] };
        setResults(body.data ?? []);
      } catch {
        /* ignore typeahead errors */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="space-y-5">
      <div ref={boxRef} className="relative flex gap-2">
        <div className="relative flex-1">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value.toUpperCase());
              setOpen(true);
            }}
            onKeyDown={(e) => e.key === "Enter" && run(q)}
            placeholder="Search a US stock or ETF (e.g. AAPL)…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {open && q.trim() && results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-sm">
              {results.map((r) => (
                <button
                  key={r.ticker}
                  onClick={() => run(r.ticker)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span>
                    <span className="font-medium">{r.ticker}</span>{" "}
                    <span className="text-slate-500">{r.name}</span>
                  </span>
                  <span className="rounded-full border px-2 py-0.5 text-[10px] text-slate-500">
                    {r.assetType}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => run(q)}
          disabled={pending || !q.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Analyzing…" : "Analyze"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {pending && (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
          Generating a grounded analysis…
        </div>
      )}

      {!pending && result?.status === "insufficient" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {result.message}
          {result.missing && result.missing.length > 0 && (
            <span className="text-amber-600"> (missing: {result.missing.join(", ")})</span>
          )}
        </div>
      )}

      {!pending && result && result.status !== "insufficient" && (
        <AnalysisCard analysis={result.analysis} />
      )}

      {/* Verdict-first, then the data ("financials"/levels/sources), news last. */}
      {analyzedTicker && !pending && <RiskPanel ticker={analyzedTicker} />}
      {analyzedTicker && !pending && <ChartPanel ticker={analyzedTicker} />}
      {analyzedTicker && !pending && <FilingsPanel ticker={analyzedTicker} />}
      {analyzedTicker && !pending && <NewsImpactPanel ticker={analyzedTicker} />}
    </div>
  );
}
