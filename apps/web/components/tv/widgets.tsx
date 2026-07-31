"use client";

import { useEffect, useRef } from "react";
import { tapeSymbols, toTradingView } from "./symbols";
import { useTvTheme } from "./use-tv-theme";

/** TradingView embed widgets (user decision: widgets over custom charts —
 * professional look, live prices, zero chart code). Each widget injects
 * TradingView's embed script into its container; keyed by theme so the
 * ThemeToggle re-mounts them with matching colors. */

function Embed({ src, config, height }: { src: string; config: object; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.innerHTML = JSON.stringify(config);
    el.appendChild(script);
    return () => {
      el.innerHTML = "";
    };
    // config is serialized so deps compare by value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, JSON.stringify(config)]);
  return <div ref={ref} style={{ height }} className="tradingview-widget-container" />;
}

/** Scrolling price strip across the top of the Overview. */
export function TickerTape({ symbols }: { symbols: string[] }) {
  const theme = useTvTheme();
  return (
    <div className="overflow-hidden rounded-lg border border-edge">
      <Embed
        key={theme}
        height={46}
        src="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"
        config={{
          symbols: tapeSymbols(symbols),
          showSymbolLogo: true,
          isTransparent: true,
          displayMode: "adaptive",
          colorTheme: theme,
          locale: "en",
        }}
      />
    </div>
  );
}

/** Full candlestick chart for a symbol (platform pages / pair detail). */
export function TvChart({ symbol, height = 420 }: { symbol: string; height?: number }) {
  const theme = useTvTheme();
  return (
    <div className="overflow-hidden rounded-lg border border-edge">
      <Embed
        key={`${theme}-${symbol}`}
        height={height}
        src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
        config={{
          symbol: toTradingView(symbol),
          interval: "D",
          theme,
          style: "1",
          locale: "en",
          hide_top_toolbar: false,
          hide_legend: false,
          allow_symbol_change: false,
          save_image: false,
          autosize: true,
          backgroundColor: theme === "dark" ? "rgba(16, 16, 20, 1)" : "rgba(255, 255, 255, 1)",
        }}
      />
    </div>
  );
}

/** Compact sparkline card for a symbol (grids of tracked markets). */
export function MiniChart({ symbol, height = 220 }: { symbol: string; height?: number }) {
  const theme = useTvTheme();
  return (
    <div className="overflow-hidden rounded-lg border border-edge">
      <Embed
        key={`${theme}-${symbol}`}
        height={height}
        src="https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js"
        config={{
          symbol: toTradingView(symbol),
          width: "100%",
          height,
          locale: "en",
          dateRange: "3M",
          colorTheme: theme,
          isTransparent: true,
          autosize: true,
        }}
      />
    </div>
  );
}
