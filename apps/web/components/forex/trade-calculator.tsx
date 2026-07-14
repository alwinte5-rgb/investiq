"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  computeTradeCalc,
  pipSizeFor,
  priceDecimalsFor,
  splitPair,
  stopPriceFromPips,
  takeProfitPriceFromPips,
  type RateTable,
  type TradeDirection,
} from "@investiq/shared/forex";
import {
  CurrencySelect,
  DirectionToggle,
  Field,
  NumberInput,
  PairSelect,
  ResultRow,
  RiskStatusBadge,
  WarningList,
  money,
  num,
} from "./calc-ui";

/**
 * The full Trade Calculator — the product's main feature. All math comes from
 * the shared engine (computeTradeCalc); this component only manages the form
 * and renders results. Stop/target price and pip fields stay synchronized.
 */

export interface TradeCalculatorDefaults {
  accountBalance?: number;
  accountCurrency?: string;
  defaultRiskPct?: number;
  maxRiskPct?: number;
  leverage?: number;
  preferredRewardRatio?: number;
}

export function TradeCalculator({
  defaults,
  compact = false,
  saveHref,
}: {
  defaults?: TradeCalculatorDefaults;
  /** Dashboard quick-calculator mode: fewer fields visible, link to full page. */
  compact?: boolean;
  /** Where "Save as Trade Plan" goes (authed planner); omitted on public pages. */
  saveHref?: string;
}) {
  const [pair, setPair] = useState("EUR/USD");
  const [direction, setDirection] = useState<TradeDirection>("BUY");
  const [balance, setBalance] = useState(defaults?.accountBalance ? String(defaults.accountBalance) : "2000");
  const [currency, setCurrency] = useState(defaults?.accountCurrency ?? "USD");
  const [riskPct, setRiskPct] = useState(defaults?.defaultRiskPct ? String(defaults.defaultRiskPct) : "1");
  const [leverage, setLeverage] = useState(defaults?.leverage ? String(defaults.leverage) : "50");
  const [entry, setEntry] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [stopPips, setStopPips] = useState("");
  const [tpPrice, setTpPrice] = useState("");
  const [tpPips, setTpPips] = useState("");
  const [unitsOverride, setUnitsOverride] = useState("");
  const [lotsOverride, setLotsOverride] = useState("");
  const [conversionRate, setConversionRate] = useState("");
  const [spreadPips, setSpreadPips] = useState("");
  const [commission, setCommission] = useState("");
  const [swap, setSwap] = useState("");

  const pipSize = pipSizeFor(pair);
  const decimals = priceDecimalsFor(pair);
  const parts = splitPair(pair);

  // Price ↔ pips synchronization: editing either side recomputes the other.
  const syncStopFromPrice = (v: string) => {
    setStopPrice(v);
    const e = num(entry);
    const p = num(v);
    setStopPips(e && p ? (Math.abs(e - p) / pipSize).toFixed(1) : "");
  };
  const syncStopFromPips = (v: string) => {
    setStopPips(v);
    const e = num(entry);
    const p = num(v);
    setStopPrice(e && p ? stopPriceFromPips(direction, e, p, pipSize).toFixed(decimals) : "");
  };
  const syncTpFromPrice = (v: string) => {
    setTpPrice(v);
    const e = num(entry);
    const p = num(v);
    setTpPips(e && p ? (Math.abs(e - p) / pipSize).toFixed(1) : "");
  };
  const syncTpFromPips = (v: string) => {
    setTpPips(v);
    const e = num(entry);
    const p = num(v);
    setTpPrice(e && p ? takeProfitPriceFromPips(direction, e, p, pipSize).toFixed(decimals) : "");
  };

  // Whether the account currency needs a conversion rate beyond the pair itself.
  const needsConversion =
    parts != null && currency !== parts.quote && currency !== parts.base;

  const result = useMemo(() => {
    const rates: RateTable = {};
    if (needsConversion && parts) {
      const r = num(conversionRate);
      if (r) rates[`${parts.quote}/${currency}`] = r;
    }
    return computeTradeCalc({
      accountBalance: num(balance) ?? 0,
      accountCurrency: currency,
      pairSymbol: pair,
      direction,
      entryPrice: num(entry) ?? 0,
      stopLossPrice: num(stopPrice),
      stopLossPips: num(stopPips),
      takeProfitPrice: num(tpPrice),
      takeProfitPips: num(tpPips),
      riskPercentage: num(riskPct) ?? 0,
      leverage: num(leverage) ?? 0,
      positionUnitsOverride: num(unitsOverride),
      lotSizeOverride: num(lotsOverride),
      rates,
      spreadPips: num(spreadPips),
      commission: num(commission),
      swap: swap.trim() !== "" && Number.isFinite(Number(swap)) ? Number(swap) : null,
      defaultRiskPct: defaults?.defaultRiskPct ?? null,
      maxRiskPct: defaults?.maxRiskPct ?? null,
      preferredRewardRatio: defaults?.preferredRewardRatio ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, direction, balance, currency, riskPct, leverage, entry, stopPrice, stopPips, tpPrice, tpPips, unitsOverride, lotsOverride, conversionRate, spreadPips, commission, swap]);

  const hasResult = result.units != null && result.units > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Inputs ── */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency pair">
            <PairSelect value={pair} onChange={setPair} />
          </Field>
          <Field label="Direction">
            <DirectionToggle value={direction} onChange={setDirection} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Account balance">
            <NumberInput value={balance} onChange={setBalance} placeholder="2000" ariaLabel="Account balance" />
          </Field>
          <Field label="Account currency">
            <CurrencySelect value={currency} onChange={setCurrency} />
          </Field>
          <Field label="Risk %" hint={defaults?.maxRiskPct ? `Your max: ${defaults.maxRiskPct}%` : undefined}>
            <NumberInput value={riskPct} onChange={setRiskPct} placeholder="1" ariaLabel="Risk percentage" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label={`Entry price`} hint={`Pip size ${pipSize}`}>
            <NumberInput value={entry} onChange={setEntry} placeholder={pipSize === 0.01 ? "145.250" : "1.08500"} ariaLabel="Entry price" />
          </Field>
          <Field label="Broker leverage" hint="e.g. 50 for 50:1">
            <NumberInput value={leverage} onChange={setLeverage} placeholder="50" ariaLabel="Broker leverage" />
          </Field>
          {needsConversion && parts && (
            <Field label={`${parts.quote}/${currency} rate`} hint="Needed to convert results into your account currency">
              <NumberInput value={conversionRate} onChange={setConversionRate} ariaLabel="Conversion rate" />
            </Field>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stop-loss price">
            <NumberInput value={stopPrice} onChange={syncStopFromPrice} ariaLabel="Stop-loss price" />
          </Field>
          <Field label="Stop loss (pips)" hint="Stays in sync with the price">
            <NumberInput value={stopPips} onChange={syncStopFromPips} ariaLabel="Stop loss in pips" />
          </Field>
          <Field label="Take-profit price">
            <NumberInput value={tpPrice} onChange={syncTpFromPrice} ariaLabel="Take-profit price" />
          </Field>
          <Field label="Take profit (pips)" hint="Stays in sync with the price">
            <NumberInput value={tpPips} onChange={syncTpFromPips} ariaLabel="Take profit in pips" />
          </Field>
        </div>

        {!compact && (
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Overrides & costs (optional)
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Position units override" hint="Recalculates your true risk">
                <NumberInput value={unitsOverride} onChange={(v) => { setUnitsOverride(v); if (v) setLotsOverride(""); }} ariaLabel="Position units override" />
              </Field>
              <Field label="Lot size override" hint="1 lot = 100,000 units">
                <NumberInput value={lotsOverride} onChange={(v) => { setLotsOverride(v); if (v) setUnitsOverride(""); }} ariaLabel="Lot size override" />
              </Field>
              <Field label="Spread (pips)">
                <NumberInput value={spreadPips} onChange={setSpreadPips} ariaLabel="Spread in pips" />
              </Field>
              <Field label="Commission">
                <NumberInput value={commission} onChange={setCommission} ariaLabel="Commission" />
              </Field>
              <Field label="Swap / rollover">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={swap}
                  aria-label="Swap or rollover cost"
                  onChange={(e) => setSwap(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm tabular-nums focus:border-blue-500 focus:outline-none"
                />
              </Field>
            </div>
          </details>
        )}
      </div>

      {/* ── Results ── */}
      <div className="space-y-3">
        <RiskStatusBadge status={result.status.status} reasons={result.status.reasons} />
        <WarningList warnings={result.warnings} />

        <div className="divide-y rounded-lg border p-4">
          <ResultRow
            label="Maximum selected risk"
            value={result.maxSelectedRiskAmount != null ? money(result.maxSelectedRiskAmount, currency) : "—"}
          />
          <ResultRow
            label="Actual risk"
            value={result.actualRiskAmount != null ? money(result.actualRiskAmount, currency) : "—"}
            sub={result.actualRiskPct != null ? `${result.actualRiskPct}% of account` : undefined}
            emphasize
          />
          <ResultRow label="Stop-loss distance" value={result.stopPips != null ? `${result.stopPips} pips` : "—"} />
          {result.takeProfitPips != null && (
            <ResultRow label="Take-profit distance" value={`${result.takeProfitPips} pips`} />
          )}
          <ResultRow
            label="Recommended size"
            value={result.recommendedUnits != null ? `${result.recommendedUnits.toLocaleString()} units` : "—"}
            sub={result.recommendedLots != null ? `${result.recommendedLots.toLocaleString(undefined, { maximumFractionDigits: 3 })} standard lots` : undefined}
            emphasize
          />
          {result.units != null && result.units !== result.recommendedUnits && (
            <ResultRow
              label="Your override size"
              value={`${result.units.toLocaleString()} units`}
              sub={result.lots != null ? `${result.lots.toLocaleString(undefined, { maximumFractionDigits: 3 })} standard lots` : undefined}
            />
          )}
          <ResultRow
            label="Pip value"
            value={result.pipValue != null ? `${money(result.pipValue, currency)} / pip` : "—"}
          />
          <ResultRow
            label="Position value (notional)"
            value={result.notionalValue != null ? money(result.notionalValue, currency) : "—"}
          />
          <ResultRow
            label="Required margin (estimated)"
            value={result.requiredMargin != null ? money(result.requiredMargin, currency) : "—"}
            sub="Brokers may calculate margin differently"
          />
          <ResultRow
            label="Effective leverage"
            value={result.effectiveLeverageLabel ?? "—"}
            sub={`Broker leverage: ${num(leverage) ?? "—"}:1`}
          />
          {result.potentialProfit != null && (
            <ResultRow label="Potential profit at target" value={money(result.potentialProfit, currency)} />
          )}
          {result.riskRewardLabel != null && (
            <ResultRow
              label="Risk-to-reward"
              value={result.riskRewardLabel}
              sub={
                result.breakEvenWinRatePct != null
                  ? `Break-even win rate before costs: ${result.breakEvenWinRatePct}%`
                  : undefined
              }
            />
          )}
          {result.costs.total > 0 && result.netPotentialProfit != null && (
            <ResultRow
              label="Est. profit after entered costs"
              value={money(result.netPotentialProfit, currency)}
              sub={[
                result.costs.spreadCost != null ? `spread ${money(result.costs.spreadCost, currency)}` : null,
                result.costs.commission != null ? `commission ${money(result.costs.commission, currency)}` : null,
                result.costs.swap != null ? `swap ${money(result.costs.swap, currency)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          )}
        </div>

        {result.summary && (
          <p aria-live="polite" className="rounded-lg border bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {result.summary}
          </p>
        )}

        <p className="text-[11px] text-slate-400">
          Estimates only — spreads, commissions, swap, slippage, and broker contract specifications
          can change actual results. The margin requirement is not the same as the amount you could
          lose.
        </p>

        <div className="flex flex-wrap gap-2">
          {compact && (
            <Link
              href="/calculator"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Open Full Trade Calculator
            </Link>
          )}
          {saveHref && hasResult && (
            <Link
              href={`${saveHref}?pair=${encodeURIComponent(pair)}&direction=${direction}&entry=${entry}&stop=${stopPrice}&tp=${tpPrice}&risk=${riskPct}&balance=${balance}&leverage=${leverage}`}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              Save as Trade Plan
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
