"use client";

import { useState, useTransition } from "react";
import { MARKET_SESSIONS } from "@investiq/shared/forex";
import {
  checkPlanAction,
  createPlanAction,
  deletePlanAction,
  updatePlanStatusAction,
  type TradeCheckResult,
  type TradePlanInput,
  type TradePlanRow,
} from "@/app/(authed)/planner/actions";
import {
  DirectionToggle,
  Field,
  NumberInput,
  PairSelect,
  RiskStatusBadge,
  Select,
  WarningList,
  money,
  num,
} from "./calc-ui";

/**
 * Trade Planner — plan form + pre-save trade check + plan list with status
 * transitions. The check and all stored numbers come from the server (single
 * source of truth); this component never computes risk itself.
 */

const STATUSES = ["DRAFT", "PLANNED", "ENTERED", "CLOSED", "CANCELLED"] as const;
const EMOTIONS = ["Calm", "Confident", "Anxious", "FOMO", "Frustrated", "Rushed", "Neutral"];

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "border-slate-200 text-slate-600",
  PLANNED: "border-blue-200 bg-blue-50 text-blue-800",
  ENTERED: "border-amber-200 bg-amber-50 text-amber-800",
  CLOSED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CANCELLED: "border-slate-200 bg-slate-50 text-slate-400",
};

export interface PlannerPrefill {
  pair?: string;
  direction?: "BUY" | "SELL";
  entry?: string;
  stop?: string;
  tp?: string;
  risk?: string;
  balance?: string;
  leverage?: string;
}

export function PlannerUI({
  initialPlans,
  openRisk,
  accountCurrency,
  defaults,
  prefill,
}: {
  initialPlans: TradePlanRow[];
  openRisk: number;
  accountCurrency: string;
  defaults: { balance: string; riskPct: string; leverage: string };
  prefill: PlannerPrefill;
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [pair, setPair] = useState(prefill.pair ?? "EUR/USD");
  const [direction, setDirection] = useState<"BUY" | "SELL">(prefill.direction ?? "BUY");
  const [entry, setEntry] = useState(prefill.entry ?? "");
  const [stop, setStop] = useState(prefill.stop ?? "");
  const [tp, setTp] = useState(prefill.tp ?? "");
  const [riskPct, setRiskPct] = useState(prefill.risk ?? defaults.riskPct);
  const [balance, setBalance] = useState(prefill.balance ?? defaults.balance);
  const [leverage, setLeverage] = useState(prefill.leverage ?? defaults.leverage);
  const [reasoning, setReasoning] = useState("");
  const [strategyTag, setStrategyTag] = useState("");
  const [session, setSession] = useState("");
  const [emotionalState, setEmotionalState] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string>("PLANNED");

  const [check, setCheck] = useState<TradeCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const buildInput = (): TradePlanInput | null => {
    const e = num(entry);
    const b = num(balance);
    const r = num(riskPct);
    const l = num(leverage);
    if (!e || !b || !r || !l) return null;
    return {
      pairSymbol: pair,
      direction,
      status,
      entryPrice: e,
      stopLossPrice: num(stop),
      takeProfitPrice: num(tp),
      riskPercentage: r,
      accountBalance: b,
      leverage: l,
      reasoning: reasoning || undefined,
      strategyTag: strategyTag || undefined,
      session: session || undefined,
      emotionalState: emotionalState || undefined,
      notes: notes || undefined,
    };
  };

  const runCheck = () => {
    const input = buildInput();
    if (!input) {
      setError("Enter the pair, entry price, balance, risk %, and leverage first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await checkPlanAction(input);
      if (res.ok) setCheck(res.data);
      else setError(res.error);
    });
  };

  const save = () => {
    const input = buildInput();
    if (!input) {
      setError("Enter the pair, entry price, balance, risk %, and leverage first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createPlanAction(input);
      if (res.ok) {
        setPlans((p) => [res.data, ...p]);
        setSaved(true);
        setCheck(null);
        setTimeout(() => setSaved(false), 4000);
      } else {
        setError(res.error);
      }
    });
  };

  const changeStatus = (id: string, next: string) => {
    startTransition(async () => {
      const res = await updatePlanStatusAction(id, next);
      if (res.ok) setPlans((p) => p.map((x) => (x.id === id ? { ...x, status: res.data.status } : x)));
      else setError(res.error);
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await deletePlanAction(id);
      if (res.ok) setPlans((p) => p.filter((x) => x.id !== id));
      else setError(res.error);
    });
  };

  return (
    <div className="space-y-8">
      {openRisk > 0 && (
        <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Open planned risk across active plans: <strong>{money(openRisk, accountCurrency)}</strong>
        </p>
      )}

      {/* ── New plan form ── */}
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold text-slate-800">New trade plan</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Currency pair">
            <PairSelect value={pair} onChange={setPair} />
          </Field>
          <Field label="Direction">
            <DirectionToggle value={direction} onChange={setDirection} />
          </Field>
          <Field label="Save as">
            <Select
              value={status}
              onChange={setStatus}
              ariaLabel="Plan status"
              options={STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))}
            />
          </Field>
          <Field label="Entry price">
            <NumberInput value={entry} onChange={setEntry} ariaLabel="Entry price" />
          </Field>
          <Field label="Stop-loss price">
            <NumberInput value={stop} onChange={setStop} ariaLabel="Stop-loss price" />
          </Field>
          <Field label="Take-profit price">
            <NumberInput value={tp} onChange={setTp} ariaLabel="Take-profit price" />
          </Field>
          <Field label="Risk %">
            <NumberInput value={riskPct} onChange={setRiskPct} ariaLabel="Risk percentage" />
          </Field>
          <Field label="Account balance">
            <NumberInput value={balance} onChange={setBalance} ariaLabel="Account balance" />
          </Field>
          <Field label="Broker leverage">
            <NumberInput value={leverage} onChange={setLeverage} ariaLabel="Broker leverage" />
          </Field>
          <Field label="Strategy tag" hint="e.g. breakout, pullback">
            <input
              value={strategyTag}
              onChange={(e) => setStrategyTag(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              maxLength={60}
            />
          </Field>
          <Field label="Session">
            <Select
              value={session}
              onChange={setSession}
              ariaLabel="Session"
              options={[
                { value: "", label: "—" },
                ...MARKET_SESSIONS.map((s) => ({ value: s.name, label: s.name })),
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
        <Field label="Trade reasoning" hint="Why this trade? Written before entry, reviewed after.">
          <textarea
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            rows={2}
            maxLength={4000}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={4000}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
        <p className="text-[11px] text-slate-400">Screenshot upload is coming soon.</p>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
        {saved && (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Trade plan saved.
          </p>
        )}

        {check && (
          <div className="space-y-2">
            <RiskStatusBadge status={check.status.status} reasons={check.status.reasons} />
            <WarningList warnings={check.warnings} />
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-md border p-2">
                <div className="text-[11px] text-slate-400">Risk</div>
                <div className="tabular-nums font-medium">
                  {check.actualRiskAmount != null ? money(check.actualRiskAmount, accountCurrency) : "—"}
                  {check.actualRiskPct != null && (
                    <span className="text-xs text-slate-400"> ({check.actualRiskPct}%)</span>
                  )}
                </div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-[11px] text-slate-400">Size</div>
                <div className="tabular-nums font-medium">
                  {check.units != null ? `${check.units.toLocaleString()} u` : "—"}
                  {check.lots != null && <span className="text-xs text-slate-400"> ({check.lots} lots)</span>}
                </div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-[11px] text-slate-400">Est. margin</div>
                <div className="tabular-nums font-medium">
                  {check.requiredMargin != null ? money(check.requiredMargin, accountCurrency) : "—"}
                </div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-[11px] text-slate-400">Reward ratio</div>
                <div className="tabular-nums font-medium">{check.riskRewardLabel ?? "—"}</div>
              </div>
            </div>
            {check.summary && <p className="text-xs leading-relaxed text-slate-500">{check.summary}</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runCheck}
            disabled={pending}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
          >
            {pending ? "Working…" : "Run trade check"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Working…" : "Save trade plan"}
          </button>
        </div>
      </section>

      {/* ── Plan list ── */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Your plans</h2>
        {plans.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
            No trade plans yet — plan your first trade above, or start from the Trade Calculator.
          </p>
        ) : (
          <div className="space-y-2">
            {plans.map((p) => (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold tabular-nums">{p.pair.symbol}</span>
                  <span className="text-sm text-slate-500">{p.direction === "BUY" ? "Buy" : "Sell"}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_BADGE[p.status] ?? ""}`}>
                    {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                  </span>
                  {p.riskStatus && (
                    <span className="text-xs text-slate-400">
                      Check: {p.riskStatus.replace(/_/g, " ").toLowerCase()}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1.5">
                    <select
                      value={p.status}
                      aria-label={`Change status of ${p.pair.symbol} plan`}
                      onChange={(e) => changeStatus(p.id, e.target.value)}
                      className="rounded-md border bg-white px-2 py-1 text-xs"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0) + s.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => remove(p.id)}
                      aria-label={`Delete ${p.pair.symbol} plan`}
                      className="rounded-md border px-2 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-5">
                  <div>Entry: <span className="tabular-nums">{Number(p.entryPrice)}</span></div>
                  <div>Stop: <span className="tabular-nums">{p.stopLossPrice ? Number(p.stopLossPrice) : "—"}</span></div>
                  <div>Target: <span className="tabular-nums">{p.takeProfitPrice ? Number(p.takeProfitPrice) : "—"}</span></div>
                  <div>
                    Risk:{" "}
                    <span className="tabular-nums">
                      {p.riskAmount ? money(Number(p.riskAmount), accountCurrency) : `${Number(p.riskPercentage)}%`}
                    </span>
                  </div>
                  <div>
                    Size:{" "}
                    <span className="tabular-nums">
                      {p.positionUnits != null ? `${p.positionUnits.toLocaleString()} u` : "—"}
                    </span>
                  </div>
                </div>
                {p.eventWarning && <p className="mt-1 text-xs text-amber-700">⚠ {p.eventWarning}</p>}
                {p.reasoning && <p className="mt-1 text-xs italic text-slate-500">“{p.reasoning}”</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
