"use client";

import { useEffect, useRef } from "react";
import { formatPairPrice } from "@investiq/shared/forex";

/**
 * Pair chart: TradingView's free Advanced Chart embed for the live candles,
 * plus a self-contained SVG "level ladder" that places the user's OWN entry /
 * stop / target by price (the free widget can't draw custom levels). The
 * ladder shows only numbers the user typed or accepted — never a prediction.
 */

function TradingViewChart({ pairSymbol, height = 320 }: { pairSymbol: string; height?: number }) {
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
      symbol: `FX:${pairSymbol.replace("/", "")}`,
      autosize: true,
      interval: "60",
      timezone: "Etc/UTC",
      theme: "light",
      style: "1",
      locale: "en",
      hide_top_toolbar: false,
      allow_symbol_change: false,
      save_image: false,
      hide_volume: true,
    });
    container.appendChild(script);
    return () => {
      container.innerHTML = "";
    };
  }, [pairSymbol]);

  return (
    <div className="w-full overflow-hidden rounded-md border bg-white" style={{ height }}>
      <div ref={containerRef} className="tradingview-widget-container h-full w-full" />
    </div>
  );
}

export interface ChartLevels {
  entry?: number | null;
  stop?: number | null;
  takeProfit?: number | null;
  current?: number | null;
}

function LevelLadder({ pairSymbol, levels }: { pairSymbol: string; levels: ChartLevels }) {
  const rows = [
    { label: "Take profit", value: levels.takeProfit, color: "#15803d" },
    { label: "Entry", value: levels.entry, color: "#1d4ed8" },
    { label: "Current", value: levels.current, color: "#111827" },
    { label: "Stop loss", value: levels.stop, color: "#b91c1c" },
  ].filter((r): r is { label: string; value: number; color: string } => r.value != null && r.value > 0);

  if (rows.length < 2) return null;

  const values = rows.map((r) => r.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pad = (max - min || 1) * 0.1;
  const hi = max + pad;
  const lo = min - pad;
  const pos = (p: number) => ((hi - p) / (hi - lo || 1)) * 100;

  return (
    <div className="space-y-1">
      <p className="text-[11px] text-slate-500">Your levels, placed by price — where the stop and target sit around entry.</p>
      <div className="relative h-40 rounded-md border bg-slate-50">
        {rows.map((r) => (
          <div key={r.label} className="absolute inset-x-0" style={{ top: `${pos(r.value)}%` }}>
            <div className="border-t border-dashed" style={{ borderColor: r.color }} />
            <span
              className="absolute right-1 -translate-y-1/2 rounded bg-white px-1.5 text-[10px] font-medium tabular-nums"
              style={{ color: r.color }}
            >
              {r.label} {formatPairPrice(r.value, pairSymbol)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PairChart({
  pairSymbol,
  levels,
  height,
}: {
  pairSymbol: string;
  levels?: ChartLevels;
  height?: number;
}) {
  return (
    <div className="space-y-3">
      <TradingViewChart pairSymbol={pairSymbol} height={height} />
      {levels && <LevelLadder pairSymbol={pairSymbol} levels={levels} />}
      <p className="text-[10px] text-slate-400">Chart by TradingView. Levels shown are your own plan inputs, not predictions.</p>
    </div>
  );
}
