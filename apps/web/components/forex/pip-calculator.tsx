"use client";

import { useState } from "react";
import {
  lotsToUnits,
  pipetteSizeFor,
  pipSizeFor,
  pipValueForUnits,
  splitPair,
  unitsToLots,
  type RateTable,
} from "@investiq/shared/forex";
import { CurrencySelect, Field, NumberInput, PairSelect, ResultRow, money, num } from "./calc-ui";

/** Standalone pip calculator with the pip/pipette education block. */
export function PipCalculator() {
  const [pair, setPair] = useState("EUR/USD");
  const [currency, setCurrency] = useState("USD");
  const [rate, setRate] = useState("");
  const [units, setUnits] = useState("10000");
  const [lots, setLots] = useState("0.1");
  const [pips, setPips] = useState("10");

  const pipSize = pipSizeFor(pair);
  const pipetteSize = pipetteSizeFor(pair);
  const parts = splitPair(pair);

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
  const r = num(rate);
  if (parts && r) rates[`${parts.base}/${parts.quote}`] = r;

  const u = num(units);
  const pipQuote = u != null ? u * pipSize : null; // pip value in quote currency
  const pipAccount =
    u != null && parts
      ? currency === parts.quote
        ? pipQuote
        : pipValueForUnits(u, { pairSymbol: pair, accountCurrency: currency, rates })
      : null;
  const p = num(pips);
  const movement = pipAccount != null && p != null ? pipAccount * p : null;

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
          <Field label="Current exchange rate" hint={parts && currency !== parts.quote ? "Needed to convert into your account currency" : "Optional for same-currency accounts"}>
            <NumberInput value={rate} onChange={setRate} ariaLabel="Current exchange rate" />
          </Field>
          <Field label="Number of pips">
            <NumberInput value={pips} onChange={setPips} ariaLabel="Number of pips" />
          </Field>
          <Field label="Position units" hint="Stays in sync with lots">
            <NumberInput value={units} onChange={syncUnits} ariaLabel="Position units" />
          </Field>
          <Field label="Lot size" hint="1 standard lot = 100,000 units">
            <NumberInput value={lots} onChange={syncLots} ariaLabel="Lot size" />
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        <div className="divide-y rounded-lg border p-4">
          <ResultRow label="Pip size" value={String(pipSize)} sub={`Pipette: ${pipetteSize}`} />
          <ResultRow
            label={`Pip value (${parts?.quote ?? "quote"})`}
            value={pipQuote != null ? `${pipQuote.toFixed(4)} ${parts?.quote ?? ""}` : "—"}
          />
          <ResultRow
            label={`Pip value (${currency})`}
            value={pipAccount != null ? `${money(pipAccount, currency)} / pip` : "Enter an exchange rate"}
            emphasize
          />
          <ResultRow
            label={`P/L for ${pips || "—"} pips`}
            value={movement != null ? money(movement, currency) : "—"}
            emphasize
          />
          <ResultRow
            label="Equivalent size"
            value={u != null ? `${u.toLocaleString()} units` : "—"}
            sub={u != null ? `${unitsToLots(u).toLocaleString(undefined, { maximumFractionDigits: 3 })} standard lots` : undefined}
          />
        </div>

        <div className="space-y-2 rounded-lg border bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
          <p>
            <strong>For most pairs, one pip is the fourth decimal place</strong> (0.0001) —
            EUR/USD moving 1.08500 → 1.08510 is one pip.
          </p>
          <p>
            <strong>For many JPY pairs, one pip is the second decimal place</strong> (0.01) —
            USD/JPY moving 145.250 → 145.260 is one pip.
          </p>
          <p>
            A <strong>pipette</strong> is one tenth of a pip: the fifth decimal place for most
            pairs, the third decimal place for JPY pairs. Brokers usually quote in pipettes, which
            is why prices show five (or three) decimals.
          </p>
        </div>
      </div>
    </div>
  );
}
