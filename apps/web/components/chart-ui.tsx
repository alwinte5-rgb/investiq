"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getChartOverlayAction, type ChartOverlay } from "@/app/(authed)/research/actions";

const money = (v: number | null | undefined) =>
  v == null ? "—" : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const TONE_COLOR: Record<string, string> = {
  POSITIVE: "#15803d",
  NEUTRAL: "#6b7280",
  NEGATIVE: "#b91c1c",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Layer 7 — Chart Intelligence overlay. A self-contained "level ladder" that
 * places the stored buy-zone / stop / target lines by price (no external chart
 * script to fail in production), plus the symbol's real earnings/news events and
 * the stored evidence ("Show Me Why"). Everything shown comes from data the user
 * already generated — the overlay can't claim a level the risk engine didn't.
 */
function LevelLadder({ overlay }: { overlay: ChartOverlay }) {
  // Anchor the scale on every level AND the live price, so the ladder shows
  // where price actually sits relative to the zones (not a disconnected box).
  const prices = overlay.levels.map((l) => l.price);
  if (overlay.currentPrice != null) prices.push(overlay.currentPrice);
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const pad = (max - min || 1) * 0.08; // headroom so labels aren't flush to the edge
  const hi = max + pad;
  const lo = min - pad;
  const fullSpan = hi - lo || 1;
  const pos = (p: number) => ((hi - p) / fullSpan) * 100; // 0% = top, 100% = bottom

  const buyLow = overlay.levels.find((l) => l.kind === "BUY_ZONE_LOW")?.price;
  const buyHigh = overlay.levels.find((l) => l.kind === "BUY_ZONE_HIGH")?.price;

  // Legend rows (ordered high → low) so every value is listed cleanly below the
  // bar — no overlapping labels on the chart itself.
  const legend = [
    ...overlay.levels.map((l) => ({ label: l.label, value: l.price, color: l.color, now: false })),
    ...(overlay.currentPrice != null
      ? [{ label: "Now", value: overlay.currentPrice, color: "#111827", now: true }]
      : []),
  ].sort((a, b) => b.value - a.value);

  const mid = (hi + lo) / 2;

  return (
    <div className="space-y-2">
      {/* Caption — says plainly what the axis measures. */}
      <p className="text-[11px] text-slate-500">
        Share price ($), high to low — where today&apos;s price sits against your buy zone, stop and
        target.
      </p>
      {/* Chart row: a left price axis + the level bar, so the vertical scale reads as price. */}
      <div className="flex gap-2">
        <div className="relative h-40 w-14 shrink-0 text-right text-[10px] tabular-nums text-slate-400">
          <span className="absolute right-0 top-0 -translate-y-1/2">{money(hi)}</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">{money(mid)}</span>
          <span className="absolute bottom-0 right-0 translate-y-1/2">{money(lo)}</span>
        </div>
        {/* Visual bar: thin colored lines only (each value is named in the legend below). */}
        <div className="relative h-40 flex-1 overflow-hidden rounded-md border bg-slate-50">
          {buyLow != null && buyHigh != null && (
            <div
              className="absolute inset-x-0 bg-blue-500/10"
              style={{ top: `${pos(buyHigh)}%`, height: `${Math.max(0, pos(buyLow) - pos(buyHigh))}%` }}
            />
          )}
          {overlay.levels.map((l) => (
            <div
              key={l.kind}
              className="absolute inset-x-0 h-px"
              style={{ top: `${pos(l.price)}%`, backgroundColor: l.color }}
            />
          ))}
          {overlay.currentPrice != null && (
            <div
              className="absolute inset-x-0 border-t border-dashed border-slate-900"
              style={{ top: `${pos(overlay.currentPrice)}%` }}
            />
          )}
        </div>
      </div>
      {/* Legend — readable values, never overlapping. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        {legend.map((row) => (
          <div key={row.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 flex-none rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className={row.now ? "font-semibold text-slate-900" : "text-slate-600"}>
              {row.label}
            </span>
            <span className="ml-auto font-medium text-slate-800">{money(row.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Real price chart via TradingView's embeddable Advanced Chart widget (the L7
 * spec). Self-cleaning per ticker. If the external widget is blocked or fails,
 * the surrounding panel (level ladder, events, evidence) still renders, and the
 * "Open on TradingView" link remains as a fallback.
 */
function TradingViewChart({ ticker }: { ticker: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      symbol: ticker,
      autosize: true,
      interval: "D",
      timezone: "Etc/UTC",
      theme: "light",
      style: "1",
      locale: "en",
      hide_top_toolbar: false,
      allow_symbol_change: false,
      save_image: false,
      hide_volume: false,
    });
    container.appendChild(script);
    return () => {
      container.innerHTML = "";
    };
  }, [ticker]);

  return (
    <div className="h-72 w-full overflow-hidden rounded-md border bg-white">
      <div ref={containerRef} className="tradingview-widget-container h-full w-full" />
    </div>
  );
}

export function ChartPanel({ ticker }: { ticker: string }) {
  const [overlay, setOverlay] = useState<ChartOverlay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(true);
  const [pending, start] = useTransition();
  // One auto-retry per ticker: the sibling RiskPanel stores levels async, so the
  // first chart fetch can land before them — re-pull once to catch up.
  const retriedFor = useRef<string | null>(null);

  function load() {
    setError(null);
    start(async () => {
      const res = await getChartOverlayAction(ticker);
      if (res.ok) {
        setOverlay(res.overlay);
        if (!res.overlay.hasRisk && retriedFor.current !== ticker) {
          retriedFor.current = ticker;
          setTimeout(load, 2000);
        }
      } else {
        setError(res.error);
        setOverlay(null);
      }
    });
  }

  // Load once a stock is accessed — runs alongside analysis/risk/news.
  useEffect(() => {
    retriedFor.current = null;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  const tvUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(ticker)}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Chart & levels</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            disabled={pending}
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {pending ? "Loading…" : "Refresh"}
          </button>
          <a
            href={tvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            Open candles on TradingView ↗
          </a>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {pending && !overlay ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-slate-500">
          Building chart overlay…
        </p>
      ) : !overlay || (!overlay.hasRisk && !overlay.hasAnalysis) ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-slate-500">
          Run an analysis and risk assessment to see buy/stop/target levels and the evidence behind
          them.
        </p>
      ) : (
        <div className="space-y-4 rounded-lg border p-4">
          <TradingViewChart ticker={ticker} />

          {overlay.hasRisk ? (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Your levels
              </h4>
              <LevelLadder overlay={overlay} />
            </div>
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              No stored risk levels yet — assess risk to draw buy/stop/target lines.
            </p>
          )}

          {overlay.events.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Events
              </h4>
              <ul className="space-y-2 text-xs">
                {overlay.events.map((e, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-20 shrink-0 text-slate-400">{fmtDate(e.date)}</span>
                    <div className="min-w-0">
                      {e.kind === "EARNINGS" ? (
                        <span className="text-slate-700">📅 {e.label}</span>
                      ) : (
                        <>
                          {e.url ? (
                            <a
                              href={e.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                              style={{ color: TONE_COLOR[e.tone ?? "NEUTRAL"] }}
                            >
                              📰 {e.label}
                            </a>
                          ) : (
                            <span style={{ color: TONE_COLOR[e.tone ?? "NEUTRAL"] }}>
                              📰 {e.label}
                            </span>
                          )}
                          {e.tone && (
                            <span
                              className="ml-1.5 align-middle text-[10px] font-medium uppercase"
                              style={{ color: TONE_COLOR[e.tone] }}
                            >
                              · {e.tone.toLowerCase()}
                            </span>
                          )}
                          {/* The grounded "why" for THIS article (L5 classification). */}
                          {e.rationale && (
                            <p className="mt-0.5 text-slate-500">{e.rationale}</p>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {overlay.showMeWhy.length > 0 && (
            <div className="border-t pt-2">
              <button
                onClick={() => setShowWhy((v) => !v)}
                className="text-xs font-medium text-blue-600 hover:underline"
                aria-expanded={showWhy}
              >
                Why these levels — supporting &amp; ⚠ caution evidence ({overlay.showMeWhy.length}){" "}
                {showWhy ? "▲" : "▼"}
              </button>
              {showWhy && (
                <ul className="mt-2 space-y-1 text-xs">
                  {overlay.showMeWhy.map((w, i) => (
                    <li key={i} className="flex gap-2">
                      <span className={w.role === "SUPPORTING" ? "text-green-600" : "text-amber-600"}>
                        {w.role === "SUPPORTING" ? "✓" : "⚠"}
                      </span>
                      <span className="text-slate-600">
                        <span className="font-medium text-slate-700">{w.sourceType}</span>
                        {w.note ? ` — ${w.note}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="border-t pt-2 text-[11px] text-slate-400">
            Levels and evidence are projected from your stored analysis and risk assessment —
            educational, not a trade instruction.
          </p>
        </div>
      )}
    </div>
  );
}
