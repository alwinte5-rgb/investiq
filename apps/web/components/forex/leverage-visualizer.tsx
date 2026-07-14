"use client";

import { useState } from "react";
import { effectiveLeverage, formatLeverage, freeMargin, requiredMargin } from "@investiq/shared/forex";
import { Field, NumberInput, ResultRow, money, num } from "./calc-ui";

/**
 * Leverage visualizer — "your money" vs "money controlled", plus the account
 * impact of fixed pip moves and percentage moves. Neutral, factual language.
 */
export function LeverageVisualizer() {
  const [balance, setBalance] = useState("1000");
  const [position, setPosition] = useState("25000");
  const [leverage, setLeverage] = useState("50");
  const [pipValue, setPipValue] = useState("2.5");

  const bal = num(balance);
  const pos = num(position);
  const lev = num(leverage);
  const pv = num(pipValue);

  const margin = pos != null && lev != null ? requiredMargin(pos, lev) : null;
  const effLev = pos != null && bal != null ? effectiveLeverage(pos, bal) : null;
  const remaining = margin != null && bal != null ? freeMargin(bal, margin) : null;

  const pipImpacts = [10, 25, 50].map((pips) => ({
    pips,
    amount: pv != null ? pv * pips : null,
    pctOfAccount: pv != null && bal != null && bal > 0 ? ((pv * pips) / bal) * 100 : null,
  }));
  const pctImpacts = [0.5, 1].map((movePct) => ({
    movePct,
    amount: pos != null ? (pos * movePct) / 100 : null,
    pctOfAccount: pos != null && bal != null && bal > 0 ? ((pos * movePct) / 100 / bal) * 100 : null,
  }));

  const barRatio = bal != null && pos != null && pos > 0 ? Math.max(2, Math.min(100, (bal / pos) * 100)) : null;
  const largeMoveRisk = pctImpacts.some((i) => i.pctOfAccount != null && i.pctOfAccount >= 25);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Account balance">
            <NumberInput value={balance} onChange={setBalance} ariaLabel="Account balance" />
          </Field>
          <Field label="Position value (notional)">
            <NumberInput value={position} onChange={setPosition} ariaLabel="Position value" />
          </Field>
          <Field label="Broker leverage" hint="e.g. 50 for 50:1">
            <NumberInput value={leverage} onChange={setLeverage} ariaLabel="Broker leverage" />
          </Field>
          <Field label="Pip value" hint="From the Pip Calculator">
            <NumberInput value={pipValue} onChange={setPipValue} ariaLabel="Pip value" />
          </Field>
        </div>

        {bal != null && pos != null && (
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-slate-700">Your money</span>
              <span className="tabular-nums font-semibold">{money(bal, "USD")}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded bg-slate-100" aria-hidden="true">
              <div className="h-full rounded bg-blue-600" style={{ width: `${barRatio ?? 0}%` }} />
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-slate-700">Money controlled</span>
              <span className="tabular-nums font-semibold">{money(pos, "USD")}</span>
            </div>
            <div className="h-3 w-full rounded bg-slate-800" aria-hidden="true" />
            <p className="text-xs text-slate-500">
              Your {money(bal, "USD")} controls a {money(pos, "USD")} position
              {effLev != null ? ` — effective leverage ${formatLeverage(effLev)}` : ""}. Every
              price move applies to the full position value, not just your own money.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="divide-y rounded-lg border p-4">
          <ResultRow label="Required margin (estimated)" value={margin != null ? money(margin, "USD") : "—"} />
          <ResultRow label="Effective leverage" value={effLev != null ? formatLeverage(effLev) : "—"} emphasize />
          <ResultRow label="Equity after margin allocation" value={remaining != null ? money(remaining, "USD") : "—"} />
          {pipImpacts.map((i) => (
            <ResultRow
              key={i.pips}
              label={`Impact of ${i.pips} pips`}
              value={i.amount != null ? money(i.amount, "USD") : "—"}
              sub={i.pctOfAccount != null ? `${i.pctOfAccount.toFixed(1)}% of account` : undefined}
            />
          ))}
          {pctImpacts.map((i) => (
            <ResultRow
              key={i.movePct}
              label={`Impact of a ${i.movePct}% price move`}
              value={i.amount != null ? money(i.amount, "USD") : "—"}
              sub={i.pctOfAccount != null ? `${i.pctOfAccount.toFixed(1)}% of account` : undefined}
            />
          ))}
        </div>

        {largeMoveRisk && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Note: at this position size, a 1% market move changes your account by a substantial
            percentage. Smaller position sizes reduce how much any single move matters.
          </p>
        )}

        <p className="text-[11px] text-slate-400">
          Broker leverage is the maximum available to you; effective leverage is what this position
          actually takes on. Leverage magnifies gains and losses equally.
        </p>
      </div>
    </div>
  );
}
