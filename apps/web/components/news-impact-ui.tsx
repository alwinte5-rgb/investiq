"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getSymbolNewsAction,
  refreshSymbolNewsAction,
  type ArticleWithImpact,
} from "@/app/(authed)/research/actions";

const IMPACT_TONE: Record<string, string> = {
  POSITIVE: "bg-green-50 text-green-700 border-green-200",
  NEUTRAL: "bg-neutral-100 text-neutral-600 border-neutral-200",
  NEGATIVE: "bg-red-50 text-red-700 border-red-200",
};
const IMPACT_LABEL: Record<string, string> = {
  POSITIVE: "Positive",
  NEUTRAL: "Neutral",
  NEGATIVE: "Negative",
};

export function NewsImpactPanel({ ticker }: { ticker: string }) {
  const [articles, setArticles] = useState<ArticleWithImpact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gated, setGated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();

  // On access, pull + classify the latest news automatically (once per ticker
  // per session so it isn't re-ingested on every revisit) — so analysis, risk
  // and news all populate together. Later visits just read the stored set.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setGated(false);
    const key = `investiq:autonews:${ticker}`;
    const auto = typeof window !== "undefined" && !sessionStorage.getItem(key);
    (async () => {
      const res = auto ? await refreshSymbolNewsAction(ticker) : await getSymbolNewsAction(ticker);
      if (auto && typeof window !== "undefined") sessionStorage.setItem(key, "1");
      if (!active) return;
      if (res.ok) setArticles(res.articles);
      else if (res.gated) setGated(true);
      else setError(res.error);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [ticker]);

  function refresh() {
    setError(null);
    start(async () => {
      const res = await refreshSymbolNewsAction(ticker);
      if (res.ok) setArticles(res.articles);
      else if (res.gated) setGated(true);
      else setError(res.error);
    });
  }

  if (gated) {
    return (
      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        News Intelligence (impact classification) is an Investor feature.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">News & impact</h3>
        <button
          onClick={refresh}
          disabled={pending}
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          {pending ? "Classifying…" : "Refresh news"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading news…</p>
      ) : !articles || articles.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-neutral-500">
          No classified news yet — tap “Refresh news” to pull and classify the latest headlines.
        </p>
      ) : (
        <ul className="space-y-2">
          {articles.map((a) => (
            <li key={a.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline"
                >
                  {a.headline}
                </a>
                {a.impact && (
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      IMPACT_TONE[a.impact.impact] ?? IMPACT_TONE.NEUTRAL
                    }`}
                  >
                    {IMPACT_LABEL[a.impact.impact] ?? a.impact.impact} · {a.impact.confidence}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[11px] text-neutral-400">
                {a.source} · {new Date(a.publishedAt).toLocaleDateString()}
              </div>
              {a.impact?.rationale && (
                <p className="mt-1 text-xs text-neutral-600">{a.impact.rationale}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
