"use client";

import { useState } from "react";
import { computeTradeCalc, pipSizeFor, splitPair, type RateTable, type TradeDirection } from "@investiq/shared/forex";
import {
  CurrencySelect,
  DirectionToggle,
  Field,
  NumberInput,
  PairSelect,
  ResultRow,
  WarningList,
  money,
  num,
} from "./calc-ui";

/**
 * Focused position-size calculator — usable without an account (public page).
 * Delegates to the same shared engine as the full Trade Calculator.
 */
export function PositionSizeCalculator() {
  const [pair, setPair] = useState("EUR/USD");
  const [direction, setDirection] = useState<TradeDirection>("BUY");
  const [balance, setBalance] = useState("2000");
  const [currency, setCurrency] = useState("USD");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [stopPips, setStopPips] = useState("25");
  const [leverage, setLeverage] = useState("50");
  const [conversionRate, setConversionRate] = useState("");

  const parts = splitPair(pair);
  const needsConversion = parts != null && currency !== parts.quote && currency !== parts.base;

  const rates: RateTable = {};
  if (needsConversion && parts) {
    const r = num(conversionRate);
    if (r) rates[`${parts.quote}/${currency}`] = r;
  }

  const result = computeTradeCalc({
    accountBalance: num(balance) ?? 0,
    accountCurrency: currency,
    pairSymbol: pair,
    direction,
    entryPrice: num(entry) ?? 0,
    stopLossPrice: num(stopPrice),
    stopLossPips: num(stopPrice) ? null : num(stopPips),
    riskPercentage: num(riskPct) ?? 0,
    leverage: num(leverage) ?? 0,
    rates,
  });

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
          <Field label="Account balance">
            <NumberInput value={balance} onChange={setBalance} ariaLabel="Account balance" />
          </Field>
          <Field label="Account currency">
            <CurrencySelect value={currency} onChange={setCurrency} />
          </Field>
          <Field label="Risk %">
            <NumberInput value={riskPct} onChange={setRiskPct} ariaLabel="Risk percentage" />
          </Field>
          <Field label="Entry price" hint={`Pip size ${pipSizeFor(pair)}`}>
            <NumberInput value={entry} onChange={setEntry} ariaLabel="Entry price" />
          </Field>
          <Field label="Stop-loss price" hint="Or use pips below">
            <NumberInput value={stopPrice} onChange={setStopPrice} ariaLabel="Stop-loss price" />
          </Field>
          <Field label="Stop loss (pips)">
            <NumberInput value={stopPips} onChange={setStopPips} ariaLabel="Stop loss in pips" />
          </Field>
          <Field label="Broker leverage" hint="For the margin estimate">
            <NumberInput value={leverage} onChange={setLeverage} ariaLabel="Broker leverage" />
          </Field>
          {needsConversion && parts && (
            <Field label={`${parts.quote}/${currency} rate`}>
              <NumberInput value={conversionRate} onChange={setConversionRate} ariaLabel="Conversion rate" />
            </Field>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <WarningList warnings={result.warnings} />
        <div className="divide-y rounded-lg border p-4">
          <ResultRow
            label="Risk amount"
            value={result.maxSelectedRiskAmount != null ? money(result.maxSelectedRiskAmount, currency) : "—"}
            emphasize
          />
          <ResultRow label="Stop-loss distance" value={result.stopPips != null ? `${result.stopPips} pips` : "—"} />
          <ResultRow
            label="Recommended size"
            value={result.recommendedUnits != null ? `${result.recommendedUnits.toLocaleString()} units` : "—"}
            sub={
              result.recommendedLots != null
                ? `${result.recommendedLots.toLocaleString(undefined, { maximumFractionDigits: 3 })} standard lots`
                : undefined
            }
            emphasize
          />
          <ResultRow
            label="Pip value"
            value={result.pipValue != null ? `${money(result.pipValue, currency)} / pip` : "—"}
          />
          <ResultRow
            label="Estimated margin required"
            value={result.requiredMargin != null ? money(result.requiredMargin, currency) : "—"}
            sub="Brokers may calculate margin differently"
          />
          <ResultRow label="Effective leverage" value={result.effectiveLeverageLabel ?? "—"} />
        </div>
        {result.summary && (
          <p aria-live="polite" className="rounded-lg border bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {result.summary}
          </p>
        )}
        <p className="text-[11px] text-slate-400">
          Estimates only. The margin requirement is not the same as the amount you could lose —
          your stop loss defines the risk.
        </p>
      </div>
    </div>
  );
}
