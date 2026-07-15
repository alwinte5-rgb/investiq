"use client";

import { useState, useTransition } from "react";
import { MARKET_SESSIONS } from "@investiq/shared/forex";
import {
  analyticsAction,
  createEntryAction,
  deleteEntryAction,
  type JournalAnalytics,
  type JournalInput,
  type JournalRow,
  type SegmentStats,
} from "@/app/(authed)/journal/actions";
import { DirectionToggle, Field, NumberInput, PairSelect, Select, money, num } from "./calc-ui";

/**
 * Journal — planned-vs-actual entry form, entry list, and process-first
 * analytics with minimum-sample-size messaging. All stats come from the API.
 */

const EMOTIONS = ["Calm", "Confident", "Anxious", "FOMO", "Frustrated", "Rushed", "Neutral"];

function numOrNull(v: string): number | null {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-slate-900">{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function SegmentTable({ title, rows }: { title: string; rows: SegmentStats[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border p-3">
      <h3 className="text-xs font-semibold text-slate-700">{title}</h3>
      <table className="mt-1 w-full text-xs">
        <thead>
          <tr className="text-left text-[11px] text-slate-400">
            <th className="py-1 font-medium">Segment</th>
            <th className="py-1 font-medium">Trades</th>
            <th className="py-1 font-medium">Win rate</th>
            <th className="py-1 font-medium">Total P/L</th>
            <th className="py-1 font-medium">Avg R</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t">
              <td className="py-1">{r.key}</td>
              <td className="py-1 tabular-nums">{r.trades}</td>
              <td className="py-1 tabular-nums">{r.winRatePct != null ? `${r.winRatePct}%` : "n < 5"}</td>
              <td className={`py-1 tabular-nums ${r.totalPl >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {r.totalPl >= 0 ? "+" : ""}
                {r.totalPl}
              </td>
              <td className="py-1 tabular-nums">{r.avgR ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function JournalUI({
  initialEntries,
  initialAnalytics,
  accountCurrency,
}: {
  initialEntries: JournalRow[];
  initialAnalytics: JournalAnalytics | null;
  accountCurrency: string;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [showForm, setShowForm] = useState(initialEntries.length === 0);

  const [pair, setPair] = useState("EUR/USD");
  const [direction, setDirection] = useState<"BUY" | "SELL">("BUY");
  const [form, setForm] = useState<Record<string, string>>({});
  const [rulesFollowed, setRulesFollowed] = useState<string>("");
  const [session, setSession] = useState("");
  const [strategyTag, setStrategyTag] = useState("");
  const [emotionalState, setEmotionalState] = useState("");
  const [notes, setNotes] = useState("");
  const [lessons, setLessons] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const f = (k: string) => form[k] ?? "";
  const setF = (k: string) => (v: string) => setForm((s) => ({ ...s, [k]: v }));

  const save = () => {
    const input: JournalInput = {
      pairSymbol: pair,
      direction,
      plannedEntry: num(f("plannedEntry")),
      actualEntry: num(f("actualEntry")),
      plannedExit: num(f("plannedExit")),
      actualExit: num(f("actualExit")),
      plannedStop: num(f("plannedStop")),
      actualStop: num(f("actualStop")),
      plannedTarget: num(f("plannedTarget")),
      actualTarget: num(f("actualTarget")),
      plannedUnits: num(f("plannedUnits")),
      actualUnits: num(f("actualUnits")),
      plannedRisk: num(f("plannedRisk")),
      actualRisk: num(f("actualRisk")),
      profitLossAmount: numOrNull(f("profitLossAmount")),
      profitLossPips: numOrNull(f("profitLossPips")),
      session: session || undefined,
      strategyTag: strategyTag || undefined,
      rulesFollowed: rulesFollowed === "" ? null : rulesFollowed === "yes",
      emotionalState: emotionalState || undefined,
      notes: notes || undefined,
      lessons: lessons || undefined,
      closedAt: numOrNull(f("profitLossAmount")) != null ? new Date().toISOString() : null,
    };
    setError(null);
    startTransition(async () => {
      const res = await createEntryAction(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEntries((e) => [res.data, ...e]);
      setForm({});
      setNotes("");
      setLessons("");
      const a = await analyticsAction();
      if (a.ok) setAnalytics(a.data);
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await deleteEntryAction(id);
      if (res.ok) {
        setEntries((e) => e.filter((x) => x.id !== id));
        const a = await analyticsAction();
        if (a.ok) setAnalytics(a.data);
      } else setError(res.error);
    });
  };

  const pricePairs: [string, string][] = [
    ["Entry", "Entry"],
    ["Exit", "Exit"],
    ["Stop", "Stop"],
    ["Target", "Target"],
  ];

  return (
    <div className="space-y-8">
      {/* ── Analytics ── */}
      {analytics && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">Analytics</h2>
          {!analytics.meetsSample ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
              {analytics.totalTrades === 0
                ? "No closed trades recorded yet. Analytics unlock after your first entries."
                : `Performance insights need at least ${analytics.minimumSample} closed trades to be meaningful — you have ${analytics.totalTrades}. Keep recording; small samples produce unreliable conclusions.`}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Closed trades" value={String(analytics.totalTrades)} />
                <Stat label="Win rate" value={analytics.winRatePct != null ? `${analytics.winRatePct}%` : "—"} />
                <Stat
                  label="Avg win / avg loss"
                  value={`${analytics.avgWin != null ? money(analytics.avgWin, accountCurrency) : "—"} / ${
                    analytics.avgLoss != null ? money(analytics.avgLoss, accountCurrency) : "—"
                  }`}
                />
                <Stat label="Average R-multiple" value={analytics.avgR != null ? `${analytics.avgR}R` : "—"} />
                <Stat
                  label="Plan adherence"
                  value={analytics.planAdherencePct != null ? `${analytics.planAdherencePct}%` : "—"}
                  sub="Trades where you followed your rules"
                />
                <Stat
                  label="Avg risk per trade"
                  value={analytics.avgRiskPerTrade != null ? money(analytics.avgRiskPerTrade, accountCurrency) : "—"}
                />
                <Stat label="Best / worst pair" value={`${analytics.bestPair ?? "—"} / ${analytics.worstPair ?? "—"}`} />
                <Stat
                  label="Best / worst session"
                  value={`${analytics.bestSession ?? "—"} / ${analytics.worstSession ?? "—"}`}
                />
              </div>
              {analytics.insights.length > 0 && (
                <div className="space-y-1 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  {analytics.insights.map((i) => (
                    <p key={i}>💡 {i}</p>
                  ))}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <SegmentTable title="By pair" rows={analytics.byPair} />
                <SegmentTable title="By session" rows={analytics.bySession} />
                <SegmentTable title="By strategy" rows={analytics.byStrategy} />
                <SegmentTable title="By day of week" rows={analytics.byWeekday} />
                <SegmentTable title="Around high-impact events" rows={analytics.byEvent ?? []} />
              </div>
              <p className="text-[11px] text-slate-400">
                Segments with fewer than 5 trades don&apos;t show rates — small samples mislead.
              </p>
            </>
          )}
        </section>
      )}

      {/* ── New entry ── */}
      <section className="space-y-3 rounded-lg border p-4">
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="text-sm font-semibold text-slate-800"
        >
          {showForm ? "▾" : "▸"} Record a trade
        </button>
        {showForm && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Currency pair">
                <PairSelect value={pair} onChange={setPair} />
              </Field>
              <Field label="Direction">
                <DirectionToggle value={direction} onChange={setDirection} />
              </Field>
              <Field label="Rules followed?">
                <Select
                  value={rulesFollowed}
                  onChange={setRulesFollowed}
                  ariaLabel="Rules followed"
                  options={[
                    { value: "", label: "—" },
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {pricePairs.map(([label]) => (
                <div key={label} className="space-y-2">
                  <Field label={`Planned ${label.toLowerCase()}`}>
                    <NumberInput value={f(`planned${label}`)} onChange={setF(`planned${label}`)} ariaLabel={`Planned ${label}`} />
                  </Field>
                  <Field label={`Actual ${label.toLowerCase()}`}>
                    <NumberInput value={f(`actual${label}`)} onChange={setF(`actual${label}`)} ariaLabel={`Actual ${label}`} />
                  </Field>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Planned units">
                <NumberInput value={f("plannedUnits")} onChange={setF("plannedUnits")} ariaLabel="Planned units" />
              </Field>
              <Field label="Actual units">
                <NumberInput value={f("actualUnits")} onChange={setF("actualUnits")} ariaLabel="Actual units" />
              </Field>
              <Field label={`Planned risk (${accountCurrency})`}>
                <NumberInput value={f("plannedRisk")} onChange={setF("plannedRisk")} ariaLabel="Planned risk" />
              </Field>
              <Field label={`Actual risk (${accountCurrency})`}>
                <NumberInput value={f("actualRisk")} onChange={setF("actualRisk")} ariaLabel="Actual risk" />
              </Field>
              <Field label={`P/L (${accountCurrency})`} hint="Negative for a loss">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={f("profitLossAmount")}
                  aria-label="Profit or loss amount"
                  onChange={(e) => setF("profitLossAmount")(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm tabular-nums"
                />
              </Field>
              <Field label="P/L (pips)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={f("profitLossPips")}
                  aria-label="Profit or loss in pips"
                  onChange={(e) => setF("profitLossPips")(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm tabular-nums"
                />
              </Field>
              <Field label="Session">
                <Select
                  value={session}
                  onChange={setSession}
                  ariaLabel="Session"
                  options={[{ value: "", label: "—" }, ...MARKET_SESSIONS.map((s) => ({ value: s.name, label: s.name }))]}
                />
              </Field>
              <Field label="Strategy tag">
                <input
                  value={strategyTag}
                  onChange={(e) => setStrategyTag(e.target.value)}
                  maxLength={60}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Emotional state">
                <Select
                  value={emotionalState}
                  onChange={setEmotionalState}
                  ariaLabel="Emotional state"
                  options={[{ value: "", label: "—" }, ...EMOTIONS.map((e) => ({ value: e, label: e }))]}
                />
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={4000}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Lessons learned">
              <textarea
                value={lessons}
                onChange={(e) => setLessons(e.target.value)}
                rows={2}
                maxLength={4000}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </Field>
            <p className="text-[11px] text-slate-400">Before/after screenshots are coming soon.</p>

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save entry"}
            </button>
          </div>
        )}
      </section>

      {/* ── Entries ── */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Entries</h2>
        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
            No journal entries yet.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => {
              const pl = e.profitLossAmount != null ? Number(e.profitLossAmount) : null;
              return (
                <div key={e.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold tabular-nums">{e.pair.symbol}</span>
                    <span className="text-sm text-slate-500">{e.direction === "BUY" ? "Buy" : "Sell"}</span>
                    {pl != null && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums ${
                          pl >= 0
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-red-200 bg-red-50 text-red-800"
                        }`}
                      >
                        {pl >= 0 ? "Gain" : "Loss"} {money(pl, accountCurrency)}
                        {e.rMultiple != null && ` · ${Number(e.rMultiple)}R`}
                      </span>
                    )}
                    {e.rulesFollowed != null && (
                      <span className="text-xs text-slate-400">
                        {e.rulesFollowed ? "Followed plan" : "Broke plan"}
                      </span>
                    )}
                    {e.session && <span className="text-xs text-slate-400">{e.session}</span>}
                    {e.strategyTag && <span className="text-xs text-slate-400">#{e.strategyTag}</span>}
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
                      aria-label={`Delete ${e.pair.symbol} entry`}
                      className="ml-auto rounded-md border px-2 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
                    <div>
                      Entry: <span className="tabular-nums">{e.actualEntry ? Number(e.actualEntry) : e.plannedEntry ? `${Number(e.plannedEntry)} (planned)` : "—"}</span>
                    </div>
                    <div>
                      Exit: <span className="tabular-nums">{e.actualExit ? Number(e.actualExit) : "—"}</span>
                    </div>
                    <div>
                      Units: <span className="tabular-nums">{e.actualUnits ?? e.plannedUnits ?? "—"}</span>
                    </div>
                    <div>
                      Pips:{" "}
                      <span className="tabular-nums">{e.profitLossPips != null ? Number(e.profitLossPips) : "—"}</span>
                    </div>
                  </div>
                  {e.lessons && <p className="mt-1 text-xs italic text-slate-500">Lesson: {e.lessons}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
