"use client";

import { useState } from "react";
import {
  effectiveLeverage,
  formatLeverage,
  freeMargin,
  lotsToUnits,
  notionalValue,
  requiredMargin,
  splitPair,
  unitsToLots,
  type RateTable,
} from "@investiq/shared/forex";
import { CurrencySelect, Field, NumberInput, PairSelect, ResultRow, money, num } from "./calc-ui";

/** Margin calculator: notional → estimated margin → free margin → effective leverage. */
export function MarginCalculator() {
  const [pair, setPair] = useState("EUR/USD");
  const [currency, setCurrency] = useState("USD");
  const [entry, setEntry] = useState("");
  const [units, setUnits] = useState("10000");
  const [lots, setLots] = useState("0.1");
  const [leverage, setLeverage] = useState("50");
  const [balance, setBalance] = useState("2000");
  const [conversionRate, setConversionRate] = useState("");

  const parts = splitPair(pair);
  const needsConversion = parts != null && currency !== parts.base && currency !== parts.quote;

  const syncUnits = (v: string) => {
    setUnits(v);
    const u = num(v);
    setLots(u ? String(unitsToLots(u)) : "");
  };
  const syncLots = (v: string) => {
    setLots(v);
    const l = num(v);
    setUnits(l ? String(lotsToUnits(l)) : "");
  };

  const rates: RateTable = {};
  const e = num(entry);
  if (parts && e) rates[`${parts.base}/${parts.quote}`] = e;
  if (needsConversion && parts) {
    const r = num(conversionRate);
    if (r) rates[`${parts.quote}/${currency}`] = r;
  }

  const u = num(units);
  const notional = u != null && e != null ? notionalValue({ pairSymbol: pair, units: u, rates, accountCurrency: currency }) : null;
  const lev = num(leverage);
  const margin = notional != null && lev != null ? requiredMargin(notional, lev) : null;
  const bal = num(balance);
  const effLev = notional != null && bal != null ? effectiveLeverage(notional, bal) : null;
  const free = margin != null && bal != null ? freeMargin(bal, margin) : null;
  const marginPct = margin != null && bal != null && bal > 0 ? (margin / bal) * 100 : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency pair">
            <PairSelect value={pair} onChange={setPair} />
          </Field>
          <Field label="Account currency">
            <CurrencySelect value={currency} onChange={setCurrency} />
          </Field>
          <Field label="Entry price">
            <NumberInput value={entry} onChange={setEntry} ariaLabel="Entry price" />
          </Field>
          <Field label="Broker leverage" hint="e.g. 50 for 50:1">
            <NumberInput value={leverage} onChange={setLeverage} ariaLabel="Broker leverage" />
          </Field>
          <Field label="Position units" hint="Stays in sync with lots">
            <NumberInput value={units} onChange={syncUnits} ariaLabel="Position units" />
          </Field>
          <Field label="Lot size">
            <NumberInput value={lots} onChange={syncLots} ariaLabel="Lot size" />
          </Field>
          <Field label="Account balance" hint="For free margin & effective leverage">
            <NumberInput value={balance} onChange={setBalance} ariaLabel="Account balance" />
          </Field>
          {needsConversion && parts && (
            <Field label={`${parts.quote}/${currency} rate`}>
              <NumberInput value={conversionRate} onChange={setConversionRate} ariaLabel="Conversion rate" />
            </Field>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="divide-y rounded-lg border p-4">
          <ResultRow label="Notional position value" value={notional != null ? money(notional, currency) : "—"} emphasize />
          <ResultRow
            label="Estimated margin required"
            value={margin != null ? money(margin, currency) : "—"}
            sub={marginPct != null ? `${marginPct.toFixed(1)}% of your account` : undefined}
            emphasize
          />
          <ResultRow label="Remaining free margin" value={free != null ? money(free, currency) : "—"} />
          <ResultRow label="Effective leverage" value={effLev != null ? formatLeverage(effLev) : "—"} />
        </div>

        <div className="rounded-lg border bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
          <p>
            <strong>
              Margin is the amount your broker may reserve to maintain the position. It is not the
              maximum amount you can lose.
            </strong>{" "}
            Your risk is defined by your stop loss — a position can require little margin while
            risking much more than that margin if no stop is set. Broker margin and margin-call
            rules vary; treat these figures as estimates.
          </p>
        </div>
      </div>
    </div>
  );
}
