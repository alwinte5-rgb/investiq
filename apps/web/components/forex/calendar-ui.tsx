"use client";

import { useMemo, useState } from "react";
import { CURRENCY_PAIRS, groupByLocalDay } from "@investiq/shared/forex";

/** Matches the API's EconomicEvent read model (Decimal→string via JSON). */
export interface CalendarEvent {
  id: string;
  name: string;
  currency: string;
  category: string | null;
  impact: "LOW" | "MEDIUM" | "HIGH";
  eventTime: string;
  previousValue: string | null;
  forecastValue: string | null;
  actualValue: string | null;
  description: string | null;
  source: string | null;
}

const IMPACT_STYLES = {
  HIGH: "border-red-200 bg-red-50 text-red-800",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-800",
  LOW: "border-slate-200 bg-slate-50 text-slate-600",
} as const;

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "NZD", "CHF"];

/** Pairs whose base or quote matches the event currency. */
function affectedPairs(currency: string): string[] {
  return CURRENCY_PAIRS.filter((p) => p.baseCurrency === currency || p.quoteCurrency === currency)
    .map((p) => p.symbol)
    .slice(0, 6);
}

export function CalendarUI({
  initial,
  providerEnabled,
  savedPairSymbols = [],
  openPlans = [],
}: {
  initial: CalendarEvent[];
  providerEnabled: boolean;
  savedPairSymbols?: string[];
  openPlans?: { pairSymbol: string; status: string }[];
}) {
  const [currency, setCurrency] = useState("");
  // Default: High + Medium visible, Low hidden (noise). "" = show everything.
  const [impact, setImpact] = useState("HIGH_MEDIUM");
  const [savedOnly, setSavedOnly] = useState(false);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  // Currencies touched by the user's saved pairs (for the "my pairs" filter).
  const savedCurrencies = useMemo(() => {
    const set = new Set<string>();
    for (const s of savedPairSymbols) {
      const [b, q] = s.split("/");
      if (b) set.add(b);
      if (q) set.add(q);
    }
    return set;
  }, [savedPairSymbols]);

  const events = useMemo(
    () =>
      initial.filter(
        (e) =>
          (!currency || e.currency === currency) &&
          (impact === ""
            ? true
            : impact === "HIGH_MEDIUM"
              ? e.impact === "HIGH" || e.impact === "MEDIUM"
              : e.impact === impact) &&
          (!savedOnly || savedCurrencies.has(e.currency)),
      ),
    [initial, currency, impact, savedOnly, savedCurrencies],
  );

  // Group by the viewer's LOCAL day; empty days simply don't appear.
  const dayGroups = useMemo(() => groupByLocalDay(events, (e) => e.eventTime), [events]);

  /** The user's own saved pairs / open plans touched by an event's currency. */
  const myExposure = (eventCurrency: string) => {
    const pairs = savedPairSymbols.filter((s) => s.split("/").includes(eventCurrency));
    const plans = openPlans.filter((p) => p.pairSymbol.split("/").includes(eventCurrency));
    return { pairs, plans };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Currency</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Impact</span>
          <select
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            className="rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="HIGH_MEDIUM">High + Medium</option>
            <option value="HIGH">High only</option>
            <option value="MEDIUM">Medium only</option>
            <option value="LOW">Low only</option>
            <option value="">All (include low)</option>
          </select>
        </label>
        {savedPairSymbols.length > 0 && (
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={savedOnly} onChange={(e) => setSavedOnly(e.target.checked)} />
            My pairs only
          </label>
        )}
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
          {providerEnabled ? (
            "No events match these filters in the next two weeks."
          ) : (
            <>
              <p className="font-medium text-slate-600">No calendar provider connected yet.</p>
              <p className="mt-1">
                Once a live economic-calendar source is configured, upcoming releases will appear
                here with impact levels, forecasts, and results — and high-impact events will show
                up as warnings in the Trade Calculator.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {dayGroups.map((group) => (
            <div key={group.key}>
              <h3 className="sticky top-0 z-10 border-b bg-white py-1.5 text-sm font-semibold text-slate-800">
                {group.label}
              </h3>
              <div className="overflow-x-auto rounded-b-lg border border-t-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium">Currency</th>
                      <th className="px-3 py-2 font-medium">Event</th>
                      <th className="px-3 py-2 font-medium">Impact</th>
                      <th className="px-3 py-2 font-medium">Previous</th>
                      <th className="px-3 py-2 font-medium">Forecast</th>
                      <th className="px-3 py-2 font-medium">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((e) => (
                      <tr
                        key={e.id}
                        onClick={() => setSelected(e)}
                        className="cursor-pointer border-b last:border-0 hover:bg-blue-50/40"
                      >
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">
                          {new Date(e.eventTime).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-3 py-2 font-medium">{e.currency}</td>
                        <td className="px-3 py-2">{e.name}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${IMPACT_STYLES[e.impact]}`}>
                            {e.impact === "HIGH" ? "High" : e.impact === "MEDIUM" ? "Medium" : "Low"}
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-slate-500">{e.previousValue ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-500">{e.forecastValue ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums font-medium">{e.actualValue ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${selected.name} details`}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-white p-5 shadow-xl sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{selected.name}</h2>
                <p className="text-xs text-slate-500">
                  {selected.currency} ·{" "}
                  {new Date(selected.eventTime).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="rounded-md border px-2.5 py-1 text-sm hover:bg-neutral-50"
              >
                ✕
              </button>
            </div>

            <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              {(["previousValue", "forecastValue", "actualValue"] as const).map((k, i) => (
                <div key={k} className="rounded-md border p-2">
                  <dt className="text-[11px] text-slate-400">{["Previous", "Forecast", "Actual"][i]}</dt>
                  <dd className="tabular-nums font-medium">{selected[k] ?? "—"}</dd>
                </div>
              ))}
            </dl>

            {selected.description && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold text-slate-700">What this measures</h3>
                <p className="mt-1 text-sm text-slate-600">{selected.description}</p>
              </div>
            )}

            <div className="mt-3">
              <h3 className="text-xs font-semibold text-slate-700">Why traders monitor it</h3>
              <p className="mt-1 text-sm text-slate-600">
                Scheduled data releases can reprice a currency within seconds of publication,
                especially when the actual figure differs from the forecast.
              </p>
            </div>

            <div className="mt-3">
              <h3 className="text-xs font-semibold text-slate-700">Pairs that may be affected</h3>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {affectedPairs(selected.currency).map((s) => (
                  <span key={s} className="rounded-full border px-2 py-0.5 text-xs tabular-nums text-slate-600">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {(() => {
              const mine = myExposure(selected.currency);
              if (mine.pairs.length === 0 && mine.plans.length === 0) return null;
              return (
                <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
                  <h3 className="text-xs font-semibold text-blue-900">Your exposure</h3>
                  {mine.plans.length > 0 && (
                    <p className="mt-1 text-xs text-blue-900">
                      Open plans on:{" "}
                      {mine.plans.map((p) => `${p.pairSymbol} (${p.status.toLowerCase()})`).join(", ")}
                    </p>
                  )}
                  {mine.pairs.length > 0 && (
                    <p className="mt-0.5 text-xs text-blue-800">Watchlist pairs: {mine.pairs.join(", ")}</p>
                  )}
                </div>
              );
            })()}

            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Volatility and spreads may increase around this release. This is awareness
              information only — it says nothing about which direction prices will move.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
