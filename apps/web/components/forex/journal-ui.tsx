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
 * Journal — ACTUALS-FIRST entry form (what actually happened is the default
 * workflow; planned values and context live behind expanders), entry list, and
 * process-first analytics with minimum-sample-size messaging. All stats come
 * from the API.
 */

const EMOTIONS = ["Calm", "Confident", "Anxious", "FOMO", "Frustrated", "Rushed", "Neutral"];

/** Prefill handed over from a closed trade plan ("Journal This Trade"). */
export interface JournalPrefill {
  tradePlanId: string;
  pairSymbol: string;
  direction: "BUY" | "SELL";
  plannedEntry?: string;
  plannedStop?: string;
  plannedTarget?: string;
  plannedUnits?: string;
  plannedRisk?: string;
  strategyTag?: string;
  session?: string;
  notes?: string;
}

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

/** datetime-local input value from an ISO string / now. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function JournalUI({
  initialEntries,
  initialAnalytics,
  accountCurrency,
  prefill,
}: {
  initialEntries: JournalRow[];
  initialAnalytics: JournalAnalytics | null;
  accountCurrency: string;
  prefill?: JournalPrefill;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [showForm, setShowForm] = useState(initialEntries.length === 0 || prefill != null);

  const [pair, setPair] = useState(prefill?.pairSymbol ?? "EUR/USD");
  const [direction, setDirection] = useState<"BUY" | "SELL">(prefill?.direction ?? "BUY");
  const [form, setForm] = useState<Record<string, string>>(() => ({
    plannedEntry: prefill?.plannedEntry ?? "",
    plannedStop: prefill?.plannedStop ?? "",
    plannedTarget: prefill?.plannedTarget ?? "",
    plannedUnits: prefill?.plannedUnits ?? "",
    plannedRisk: prefill?.plannedRisk ?? "",
  }));
  const [openedAt, setOpenedAt] = useState("");
  const [closedAt, setClosedAt] = useState(() => toLocalInput(new Date()));
  const [rulesFollowed, setRulesFollowed] = useState<string>("");
  const [session, setSession] = useState(prefill?.session ?? "");
  const [strategyTag, setStrategyTag] = useState(prefill?.strategyTag ?? "");
  const [emotionalState, setEmotionalState] = useState("");
  const [notes, setNotes] = useState(prefill?.notes ?? "");
  const [lessons, setLessons] = useState("");
  const [showPlanned, setShowPlanned] = useState(prefill != null);

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const f = (k: string) => form[k] ?? "";
  const setF = (k: string) => (v: string) => setForm((s) => ({ ...s, [k]: v }));

  const save = () => {
    const input: JournalInput = {
      pairSymbol: pair,
      direction,
      tradePlanId: prefill?.tradePlanId,
      // Actuals — the primary workflow.
      actualEntry: num(f("actualEntry")),
      actualExit: num(f("actualExit")),
      actualStop: num(f("actualStop")),
      actualUnits: num(f("actualUnits")),
      actualRisk: num(f("actualRisk")),
      profitLossAmount: numOrNull(f("profitLossAmount")),
      profitLossPips: numOrNull(f("profitLossPips")),
      openedAt: openedAt ? new Date(openedAt).toISOString() : null,
      closedAt: closedAt ? new Date(closedAt).toISOString() : null,
      // Planned — from the expander (or the plan prefill).
      plannedEntry: num(f("plannedEntry")),
      plannedExit: num(f("plannedExit")),
      plannedStop: num(f("plannedStop")),
      plannedTarget: num(f("plannedTarget")),
      plannedUnits: num(f("plannedUnits")),
      plannedRisk: num(f("plannedRisk")),
      // Context.
      session: session || undefined,
      strategyTag: strategyTag || undefined,
      rulesFollowed: rulesFollowed === "" ? null : rulesFollowed === "yes",
      emotionalState: emotionalState || undefined,
      notes: notes || undefined,
      lessons: lessons || undefined,
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

  const dateInput = (value: string, onChange: (v: string) => void, aria: string) => (
    <input
      type="datetime-local"
      value={value}
      aria-label={aria}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border px-3 py-2 text-sm"
    />
  );

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

      {/* ── New entry (actuals-first) ── */}
      <section className="space-y-3 rounded-lg border p-4">
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="text-sm font-semibold text-slate-800"
        >
          {showForm ? "▾" : "▸"} Record a trade
        </button>
        {prefill && (
          <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            Journaling your {prefill.pairSymbol} {prefill.direction === "BUY" ? "buy" : "sell"} plan — planned
            values are prefilled below. Enter what actually happened.
          </p>
        )}
        {showForm && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Currency pair">
                <PairSelect value={pair} onChange={setPair} />
              </Field>
              <Field label="Direction">
                <DirectionToggle value={direction} onChange={setDirection} />
              </Field>
            </div>

            {/* What actually happened — the default workflow. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Actual entry">
                <NumberInput value={f("actualEntry")} onChange={setF("actualEntry")} ariaLabel="Actual entry" />
              </Field>
              <Field label="Actual exit">
                <NumberInput value={f("actualExit")} onChange={setF("actualExit")} ariaLabel="Actual exit" />
              </Field>
              <Field label="Actual stop">
                <NumberInput value={f("actualStop")} onChange={setF("actualStop")} ariaLabel="Actual stop" />
              </Field>
              <Field label="Position size (units)">
                <NumberInput value={f("actualUnits")} onChange={setF("actualUnits")} ariaLabel="Actual units" />
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
              <Field label="Opened">{dateInput(openedAt, setOpenedAt, "Date opened")}</Field>
              <Field label="Closed">{dateInput(closedAt, setClosedAt, "Date closed")}</Field>
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

            {/* Planned values — expander (prefilled when journaling a plan). */}
            <details
              open={showPlanned}
              onToggle={(e) => setShowPlanned((e.target as HTMLDetailsElement).open)}
              className="rounded-md border p-3"
            >
              <summary className="cursor-pointer text-sm font-medium text-slate-700">Add planned values</summary>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Planned entry">
                  <NumberInput value={f("plannedEntry")} onChange={setF("plannedEntry")} ariaLabel="Planned entry" />
                </Field>
                <Field label="Planned exit">
                  <NumberInput value={f("plannedExit")} onChange={setF("plannedExit")} ariaLabel="Planned exit" />
                </Field>
                <Field label="Planned stop">
                  <NumberInput value={f("plannedStop")} onChange={setF("plannedStop")} ariaLabel="Planned stop" />
                </Field>
                <Field label="Planned target">
                  <NumberInput value={f("plannedTarget")} onChange={setF("plannedTarget")} ariaLabel="Planned target" />
                </Field>
                <Field label="Planned units">
                  <NumberInput value={f("plannedUnits")} onChange={setF("plannedUnits")} ariaLabel="Planned units" />
                </Field>
                <Field label={`Planned risk (${accountCurrency})`}>
                  <NumberInput value={f("plannedRisk")} onChange={setF("plannedRisk")} ariaLabel="Planned risk" />
                </Field>
                <Field label={`Actual risk (${accountCurrency})`} hint="For the R-multiple">
                  <NumberInput value={f("actualRisk")} onChange={setF("actualRisk")} ariaLabel="Actual risk" />
                </Field>
              </div>
            </details>

            {/* Context — expander. */}
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                Add context (session, strategy, discipline)
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                <Field label="Emotional state">
                  <Select
                    value={emotionalState}
                    onChange={setEmotionalState}
                    ariaLabel="Emotional state"
                    options={[{ value: "", label: "—" }, ...EMOTIONS.map((e) => ({ value: e, label: e }))]}
                  />
                </Field>
              </div>
            </details>

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
                    {e.tradePlanId && (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-800">
                        From plan
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
                      Entry:{" "}
                      <span className="tabular-nums">
                        {e.actualEntry ? Number(e.actualEntry) : e.plannedEntry ? `${Number(e.plannedEntry)} (planned)` : "—"}
                      </span>
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
