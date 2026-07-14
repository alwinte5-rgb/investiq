"use client";

import { useState } from "react";
import {
  breakEvenWinRatePct,
  formatRiskReward,
  pipSizeFor,
  priceDiffToPips,
  riskRewardRatio,
  RR_BREAK_EVEN_REFERENCE,
  type TradeDirection,
} from "@investiq/shared/forex";
import { DirectionToggle, Field, NumberInput, PairSelect, ResultRow, num } from "./calc-ui";

/** Risk-to-reward calculator with the break-even reference table. */
export function RiskRewardCalculator() {
  const [pair, setPair] = useState("EUR/USD");
  const [direction, setDirection] = useState<TradeDirection>("BUY");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [spreadPips, setSpreadPips] = useState("");
  const [commission, setCommission] = useState("");

  const pipSize = pipSizeFor(pair);
  const e = num(entry);
  const s = num(stop);
  const t = num(target);

  const riskPips = e != null && s != null ? priceDiffToPips(e - s, pipSize) : null;
  const rewardPips = e != null && t != null ? priceDiffToPips(e - t, pipSize) : null;
  const ratio = riskPips != null && rewardPips != null ? riskRewardRatio(riskPips, rewardPips) : null;
  const breakEven = riskPips != null && rewardPips != null ? breakEvenWinRatePct(riskPips, rewardPips) : null;

  // Net reward after entered costs, expressed in pips-equivalent terms: spread
  // reduces the captured move; commission is shown separately (currency unknown here).
  const sp = num(spreadPips);
  const netRewardPips = rewardPips != null ? rewardPips - (sp ?? 0) : null;
  const netRatio = riskPips != null && netRewardPips != null && netRewardPips > 0 ? riskRewardRatio(riskPips, netRewardPips) : null;

  const wrongSide =
    e != null &&
    ((direction === "BUY" && ((s != null && s > e) || (t != null && t < e))) ||
      (direction === "SELL" && ((s != null && s < e) || (t != null && t > e))));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency pair">
            <PairSelect value={pair} onChange={setPair} />
          </Field>
          <Field label="Direction">
            <DirectionToggle value={direction} onChange={setDirection} />
          </Field>
          <Field label="Entry price">
            <NumberInput value={entry} onChange={setEntry} ariaLabel="Entry price" />
          </Field>
          <Field label="Stop-loss price">
            <NumberInput value={stop} onChange={setStop} ariaLabel="Stop-loss price" />
          </Field>
          <Field label="Take-profit price">
            <NumberInput value={target} onChange={setTarget} ariaLabel="Take-profit price" />
          </Field>
          <Field label="Spread (pips, optional)">
            <NumberInput value={spreadPips} onChange={setSpreadPips} ariaLabel="Spread in pips" />
          </Field>
          <Field label="Commission (optional)" hint="Shown for awareness; not netted into pips">
            <NumberInput value={commission} onChange={setCommission} ariaLabel="Commission" />
          </Field>
        </div>
        {wrongSide && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            ⚠ For a {direction === "BUY" ? "buy" : "sell"} trade the stop normally sits{" "}
            {direction === "BUY" ? "below" : "above"} entry and the target{" "}
            {direction === "BUY" ? "above" : "below"} it — double-check the prices.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="divide-y rounded-lg border p-4">
          <ResultRow label="Risk distance" value={riskPips != null ? `${riskPips.toFixed(1)} pips` : "—"} />
          <ResultRow label="Reward distance" value={rewardPips != null ? `${rewardPips.toFixed(1)} pips` : "—"} />
          <ResultRow label="Risk-to-reward" value={ratio != null ? formatRiskReward(ratio) : "—"} emphasize />
          <ResultRow
            label="Break-even win rate (before costs)"
            value={breakEven != null ? `${breakEven.toFixed(1)}%` : "—"}
            emphasize
          />
          {sp != null && netRatio != null && (
            <ResultRow
              label="After entered spread"
              value={formatRiskReward(netRatio)}
              sub={`Reward net of spread: ${netRewardPips!.toFixed(1)} pips`}
            />
          )}
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-slate-800">Break-even reference (before costs)</h3>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1 font-medium">Risk : Reward</th>
                <th className="py-1 font-medium">Win rate needed to break even</th>
              </tr>
            </thead>
            <tbody>
              {RR_BREAK_EVEN_REFERENCE.map((row) => (
                <tr key={row.ratio} className="border-t">
                  <td className="py-1.5 tabular-nums">{row.ratio}</td>
                  <td className="py-1.5 tabular-nums">≈ {row.breakEvenPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-slate-400">
            Spread, commission, swap, and slippage raise the true break-even rate. No ratio
            guarantees profitability — targets still have to be realistic for the pair.
          </p>
        </div>
      </div>
    </div>
  );
}
