"use client";

import { useState } from "react";
import Link from "next/link";
import {
  pipValuePerUnit,
  positionSizeUnits,
  riskAmount,
  unitsToLots,
  type RateTable,
  type TradeDirection,
} from "@investiq/shared/forex";
import { DirectionToggle, Field, NumberInput, PairSelect, money, num } from "./calc-ui";

/**
 * Dashboard quick calculator — a compact pre-trade check, NOT the full form.
 * Four inputs (pair, direction, risk %, stop pips), one primary result
 * (recommended position), two supporting values. Balance/currency come from
 * saved settings; everything transfers to the full calculator via the link.
 */
export function QuickCalculator({
  balance,
  currency,
  defaultRiskPct,
  leverage,
  rates,
}: {
  balance: number;
  currency: string;
  defaultRiskPct: number;
  leverage: number;
  /** Live rates from the dashboard fetch (for quote→account conversion). */
  rates: RateTable;
}) {
  const [pair, setPair] = useState("EUR/USD");
  const [direction, setDirection] = useState<TradeDirection>("BUY");
  const [riskPct, setRiskPct] = useState(String(defaultRiskPct));
  const [stopPips, setStopPips] = useState("25");

  const risk = num(riskPct) != null ? riskAmount(balance, num(riskPct)!) : null;
  const perUnit = pipValuePerUnit({ pairSymbol: pair, accountCurrency: currency, rates });
  const stop = num(stopPips);
  const units =
    risk != null && stop != null && perUnit != null
      ? positionSizeUnits({ riskAmount: risk, stopPips: stop, pairSymbol: pair, accountCurrency: currency, rates })
      : null;
  const pipValue = units != null && perUnit != null ? units * perUnit : null;
  const maxLoss = units != null && perUnit != null && stop != null ? units * perUnit * stop : null;

  const fullHref = `/calculator?pair=${encodeURIComponent(pair)}&direction=${direction}&risk=${riskPct}&stopPips=${stopPips}&balance=${balance}&leverage=${leverage}`;

  return (
    <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Currency pair">
            <PairSelect value={pair} onChange={setPair} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Direction">
            <DirectionToggle value={direction} onChange={setDirection} />
          </Field>
        </div>
        <Field label="Risk %">
          <NumberInput value={riskPct} onChange={setRiskPct} ariaLabel="Risk percentage" />
        </Field>
        <Field label="Stop loss (pips)">
          <NumberInput value={stopPips} onChange={setStopPips} ariaLabel="Stop loss in pips" />
        </Field>
      </div>

      <div className="flex flex-col justify-between gap-3">
        <div className="rounded-lg border bg-slate-50 p-4 text-center">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Recommended position</div>
          {units != null && units > 0 ? (
            <>
              <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {units.toLocaleString()} units
              </div>
              <div className="text-sm text-slate-500">
                {unitsToLots(units).toLocaleString(undefined, { maximumFractionDigits: 3 })} standard lots
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-slate-500">
              {perUnit == null
                ? "This pair needs an exchange rate — use the full calculator."
                : "Enter a risk % and stop distance."}
            </div>
          )}
          <div className="mt-2 flex justify-center gap-4 text-xs text-slate-500">
            <span>
              Max loss:{" "}
              <span className="font-medium tabular-nums text-slate-700">
                {maxLoss != null ? money(maxLoss, currency) : "—"}
              </span>
            </span>
            <span>
              Pip value:{" "}
              <span className="font-medium tabular-nums text-slate-700">
                {pipValue != null ? money(pipValue, currency) : "—"}
              </span>
            </span>
          </div>
        </div>
        <Link
          href={fullHref}
          className="rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
        >
          Open Full Calculator
        </Link>
        <p className="text-center text-[10px] text-slate-400">
          Uses your saved balance ({money(balance, currency)}). Estimates only.
        </p>
      </div>
    </div>
  );
}
