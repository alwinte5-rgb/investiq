import Link from "next/link";
import { explainRate, findPair } from "@investiq/shared";

/**
 * Dashboard watchlist cards. Server-rendered (no interactivity needed): pair
 * metadata comes from the API, live rates from the rate service when a
 * provider is enabled — otherwise an honest "no live rate" state.
 */

export interface WatchlistPair {
  symbol: string;
  displayName: string;
  baseCurrency: string;
  quoteCurrency: string;
  pipSize: number;
  category: string;
  sessions: string[];
}

export function WatchlistCards({
  pairs,
  rates,
  lastUpdated,
}: {
  pairs: WatchlistPair[];
  rates: Record<string, number>;
  lastUpdated: string | null;
}) {
  if (pairs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-5 text-sm text-slate-500">
        No pairs to show yet — browse{" "}
        <Link href="/pairs" className="text-blue-600 hover:underline">
          Currency Pairs
        </Link>{" "}
        to explore the catalog.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pairs.map((p) => {
          const rate = rates[p.symbol];
          const info = findPair(p.symbol);
          return (
            <Link
              key={p.symbol}
              href={`/pairs/${p.symbol.replace("/", "-")}`}
              className="rounded-lg border p-4 hover:border-blue-300 hover:bg-blue-50/30"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-semibold tabular-nums text-slate-900">{p.symbol}</span>
                {rate != null ? (
                  <span className="tabular-nums text-sm font-medium text-slate-800">{rate}</span>
                ) : (
                  <span className="text-[11px] text-slate-400">No live rate</span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {p.baseCurrency}/{p.quoteCurrency} · pip {p.pipSize}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                {rate != null && info
                  ? explainRate(info, rate)
                  : `One ${p.baseCurrency} is quoted in ${p.quoteCurrency}. Enter the current rate manually in the calculator.`}
              </p>
              {p.sessions.length > 0 && (
                <p className="mt-1 text-[11px] text-slate-400">Most active: {p.sessions.join(", ")}</p>
              )}
            </Link>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400">
        {lastUpdated
          ? `Rates last updated ${new Date(lastUpdated).toLocaleTimeString()}.`
          : "Live rates are not connected yet — calculators accept manually entered rates and always work."}
      </p>
    </div>
  );
}
