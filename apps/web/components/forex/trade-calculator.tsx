"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { getPairInsightAction, type PairInsightDto } from "@/app/(authed)/calculator/actions";
import { Term } from "@/components/term";
import { PairChart } from "./pair-chart";
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
 * and renders results. Two entry modes over ONE shared state (values survive
 * switching): a guided stepper for beginners and the full form for experienced
 * traders. Neither is mandatory.
 */

export interface TradeCalculatorDefaults {
  accountBalance?: number;
  accountCurrency?: string;
  defaultRiskPct?: number;
  maxRiskPct?: number;
  leverage?: number;
  preferredRewardRatio?: number;
  /** From user settings: opens in guided mode when true. */
  beginnerMode?: boolean;
}

/** Prefill from the dashboard quick calculator (via query params). */
export interface TradeCalculatorInitial {
  pair?: string;
  direction?: TradeDirection;
  entry?: string;
  stopPips?: string;
  riskPct?: string;
  balance?: string;
  leverage?: string;
}

const GUIDED_STEPS = [
  { id: "pair", title: "Choose your currency pair" },
  { id: "direction", title: "Buy or sell?" },
  { id: "risk", title: "How much are you willing to risk?" },
  { id: "entry", title: "Entry price" },
  { id: "stop", title: "Where is your stop loss?" },
  { id: "target", title: "Take profit (optional)" },
  { id: "review", title: "Review your trade" },
] as const;

export function TradeCalculator({
  defaults,
  initial,
  saveHref,
  withInsight = true,
}: {
  defaults?: TradeCalculatorDefaults;
  initial?: TradeCalculatorInitial;
  /** Where "Save as Trade Plan" goes (authed planner); omitted on public pages. */
  saveHref?: string;
  /** Live rate + suggested stop/TP (authed only — needs the API). */
  withInsight?: boolean;
}) {
  const [pair, setPair] = useState(initial?.pair ?? "EUR/USD");
  const [direction, setDirection] = useState<TradeDirection>(initial?.direction ?? "BUY");
  const [balance, setBalance] = useState(
    initial?.balance ?? (defaults?.accountBalance ? String(defaults.accountBalance) : "2000"),
  );
  const [currency, setCurrency] = useState(defaults?.accountCurrency ?? "USD");
  const [riskPct, setRiskPct] = useState(
    initial?.riskPct ?? (defaults?.defaultRiskPct ? String(defaults.defaultRiskPct) : "1"),
  );
  const [leverage, setLeverage] = useState(
    initial?.leverage ?? (defaults?.leverage ? String(defaults.leverage) : "50"),
  );
  const [entry, setEntry] = useState(initial?.entry ?? "");
  const [stopPrice, setStopPrice] = useState("");
  const [stopPips, setStopPips] = useState(initial?.stopPips ?? "");
  const [tpPrice, setTpPrice] = useState("");
  const [tpPips, setTpPips] = useState("");
  const [unitsOverride, setUnitsOverride] = useState("");
  const [lotsOverride, setLotsOverride] = useState("");
  const [conversionRate, setConversionRate] = useState("");
  const [spreadPips, setSpreadPips] = useState("");
  const [commission, setCommission] = useState("");
  const [swap, setSwap] = useState("");

  // ── Guided vs full form (one shared state; switching never loses values) ──
  const [mode, setMode] = useState<"guided" | "full">(defaults?.beginnerMode ? "guided" : "full");
  const [step, setStep] = useState(0);

  const pipSize = pipSizeFor(pair);
  const decimals = priceDecimalsFor(pair);
  const parts = splitPair(pair);

  // ── Live rate + suggested levels (authed pages) ────────────────────────────
  const [insight, setInsight] = useState<PairInsightDto | null>(null);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);
  const [insightPending, startInsight] = useTransition();

  useEffect(() => {
    if (!withInsight) return;
    setInsight(null);
    startInsight(async () => {
      const res = await getPairInsightAction(pair, direction);
      if (res.ok) setInsight(res.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, direction, withInsight]);

  const useLiveRate = () => {
    if (insight?.rate != null) setEntry(insight.rate.toFixed(decimals));
  };

  const applySuggestion = () => {
    const entryNow = num(entry) ?? insight?.rate ?? null;
    if (entryNow == null) return;
    if (num(entry) == null && insight?.rate != null) setEntry(insight.rate.toFixed(decimals));
    startInsight(async () => {
      const res = await getPairInsightAction(pair, direction, entryNow);
      if (!res.ok || !res.data.suggested) {
        setSuggestNote("Couldn't compute a suggestion right now — set the stop manually.");
        return;
      }
      const s = res.data.suggested;
      setStopPrice(s.stopPrice.toFixed(decimals));
      setStopPips(s.stopPips.toFixed(1));
      setTpPrice(s.takeProfitPrice.toFixed(decimals));
      setTpPips(s.takeProfitPips.toFixed(1));
      setSuggestNote(
        s.basis === "atr"
          ? `Suggested from recent daily volatility (ATR14 ≈ ${s.atrPips} pips: stop ${s.stopPips} pips away, target at your 1:${s.rewardRatio} ratio). A starting point, not a prediction — adjust to your plan.`
          : `Suggested from typical distances for this pair type (stop ${s.stopPips} pips, target at your 1:${s.rewardRatio} ratio). Live volatility data was unavailable — adjust to your plan.`,
      );
    });
  };

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
  const needsConversion = parts != null && currency !== parts.quote && currency !== parts.base;

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

  // ── Reusable field fragments (shared by guided + full modes) ──────────────
  const entryField = (
    <Field
      label="Entry price"
      hint={
        insight?.rate != null
          ? `Live: ${insight.rate.toFixed(decimals)} — real ${pair} quotes look like this (pip = ${pipSize})`
          : `Real ${pair} quotes look like ${pipSize === 0.01 ? "145.250" : "1.08500"} (pip = ${pipSize})`
      }
    >
      <div className="flex gap-1">
        <NumberInput
          value={entry}
          onChange={setEntry}
          placeholder={pipSize === 0.01 ? "145.250" : "1.08500"}
          ariaLabel="Entry price"
        />
        {withInsight && insight?.rate != null && (
          <button
            type="button"
            onClick={useLiveRate}
            className="whitespace-nowrap rounded-md border px-2 text-xs text-blue-700 hover:bg-blue-50"
          >
            Use live
          </button>
        )}
      </div>
    </Field>
  );

  const suggestButton = withInsight && (
    <div className="space-y-1">
      <button
        type="button"
        onClick={applySuggestion}
        disabled={insightPending}
        className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
      >
        {insightPending ? "Working…" : "Suggest stop & target"}
      </button>
      {suggestNote && <p className="text-[11px] leading-relaxed text-slate-500">{suggestNote}</p>}
    </div>
  );

  const stopFields = (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Stop-loss price">
        <NumberInput value={stopPrice} onChange={syncStopFromPrice} ariaLabel="Stop-loss price" />
      </Field>
      <Field label="Stop loss (pips)" hint="Stays in sync with the price">
        <NumberInput value={stopPips} onChange={syncStopFromPips} ariaLabel="Stop loss in pips" />
      </Field>
    </div>
  );

  const tpFields = (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Take-profit price">
        <NumberInput value={tpPrice} onChange={syncTpFromPrice} ariaLabel="Take-profit price" />
      </Field>
      <Field label="Take profit (pips)" hint="Stays in sync with the price">
        <NumberInput value={tpPips} onChange={syncTpFromPips} ariaLabel="Take profit in pips" />
      </Field>
    </div>
  );

  const conversionField = needsConversion && parts && (
    <Field label={`${parts.quote}/${currency} rate`} hint="Needed to convert results into your account currency">
      <NumberInput value={conversionRate} onChange={setConversionRate} ariaLabel="Conversion rate" />
    </Field>
  );

  /** Advanced options — identical set in both modes, always behind an expander. */
  const advancedSection = (label: string) => (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium text-slate-700">{label}</summary>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Account currency">
          <CurrencySelect value={currency} onChange={setCurrency} />
        </Field>
        <Field label="Broker leverage" hint="e.g. 50 for 50:1">
          <NumberInput value={leverage} onChange={setLeverage} placeholder="50" ariaLabel="Broker leverage" />
        </Field>
        {conversionField}
        <Field label={<Term>Spread</Term>}>
          <NumberInput value={spreadPips} onChange={setSpreadPips} ariaLabel="Spread in pips" />
        </Field>
        <Field label={<Term>Commission</Term>}>
          <NumberInput value={commission} onChange={setCommission} ariaLabel="Commission" />
        </Field>
        <Field label={<Term k="swap">Swap / rollover</Term>}>
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
        <Field label="Position units override" hint="Recalculates your true risk">
          <NumberInput
            value={unitsOverride}
            onChange={(v) => {
              setUnitsOverride(v);
              if (v) setLotsOverride("");
            }}
            ariaLabel="Position units override"
          />
        </Field>
        <Field label="Lot size override" hint="1 lot = 100,000 units">
          <NumberInput
            value={lotsOverride}
            onChange={(v) => {
              setLotsOverride(v);
              if (v) setUnitsOverride("");
            }}
            ariaLabel="Lot size override"
          />
        </Field>
      </div>
    </details>
  );

  // ── Guided step content (each step edits the same state as the full form) ──
  const stepBody = (id: (typeof GUIDED_STEPS)[number]["id"]) => {
    switch (id) {
      case "pair":
        return (
          <div className="space-y-2">
            <PairSelect value={pair} onChange={setPair} />
            <p className="text-xs text-slate-500">
              The rate is how much of the second (quote) currency one unit of the first (base)
              currency buys.
            </p>
          </div>
        );
      case "direction":
        return (
          <div className="space-y-2">
            <DirectionToggle value={direction} onChange={setDirection} />
            <p className="text-xs text-slate-500">
              {direction === "BUY"
                ? `Buying ${pair} means you expect the ${parts?.base ?? "base"} to strengthen against the ${parts?.quote ?? "quote"}.`
                : `Selling ${pair} means you expect the ${parts?.base ?? "base"} to weaken against the ${parts?.quote ?? "quote"}.`}
            </p>
          </div>
        );
      case "risk":
        return (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Account balance">
              <NumberInput value={balance} onChange={setBalance} placeholder="2000" ariaLabel="Account balance" />
            </Field>
            <Field label="Risk %" hint={defaults?.maxRiskPct ? `Your max: ${defaults.maxRiskPct}%` : "1% is a common starting point"}>
              <NumberInput value={riskPct} onChange={setRiskPct} placeholder="1" ariaLabel="Risk percentage" />
            </Field>
            {num(balance) != null && num(riskPct) != null && (
              <p className="col-span-2 text-xs text-slate-500">
                You&apos;re choosing to risk {money((num(balance)! * num(riskPct)!) / 100, currency)} on this trade.
              </p>
            )}
          </div>
        );
      case "entry":
        return entryField;
      case "stop":
        return (
          <div className="space-y-3">
            {stopFields}
            {suggestButton}
            <p className="text-xs text-slate-500">
              The stop defines your risk: for a {direction === "BUY" ? "buy" : "sell"} it normally
              sits {direction === "BUY" ? "below" : "above"} your entry.
            </p>
          </div>
        );
      case "target":
        return (
          <div className="space-y-3">
            {tpFields}
            <p className="text-xs text-slate-500">
              Optional — setting a target unlocks the risk-to-reward ratio and break-even win rate.
            </p>
          </div>
        );
      case "review":
        return (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              Your full results are on the right — check the status badge and the plain-language
              summary before deciding.
            </p>
            {saveHref && hasResult && (
              <Link
                href={`${saveHref}?pair=${encodeURIComponent(pair)}&direction=${direction}&entry=${entry}&stop=${stopPrice}&tp=${tpPrice}&risk=${riskPct}&balance=${balance}&leverage=${leverage}`}
                className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save as Trade Plan
              </Link>
            )}
          </div>
        );
    }
  };

  const current = GUIDED_STEPS[Math.min(step, GUIDED_STEPS.length - 1)]!;

  return (
    <div className="space-y-3">
      {/* Mode toggle + live-update hint */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">Results update automatically as you enter your trade.</p>
        <div role="radiogroup" aria-label="Calculator mode" className="flex rounded-md border p-0.5 text-xs">
          {(["guided", "full"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`rounded px-3 py-1 font-medium ${
                mode === m ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {m === "guided" ? "Guided" : "Full form"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Inputs ── */}
        <div className="space-y-3">
          {mode === "guided" ? (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800">
                  Step {step + 1} of {GUIDED_STEPS.length}: {current.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setMode("full")}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Show all fields
                </button>
              </div>
              {/* Progress dots (text label above carries the meaning) */}
              <div className="flex gap-1" aria-hidden="true">
                {GUIDED_STEPS.map((s, i) => (
                  <span
                    key={s.id}
                    className={`h-1.5 flex-1 rounded ${i <= step ? "bg-blue-600" : "bg-slate-200"}`}
                  />
                ))}
              </div>

              {stepBody(current.id)}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                  className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-40"
                >
                  Back
                </button>
                {step < GUIDED_STEPS.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.min(GUIDED_STEPS.length - 1, s + 1))}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Next
                  </button>
                )}
              </div>

              {advancedSection("Advanced options")}
            </div>
          ) : (
            <>
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
                <Field label="Risk %" hint={defaults?.maxRiskPct ? `Your max: ${defaults.maxRiskPct}%` : undefined}>
                  <NumberInput value={riskPct} onChange={setRiskPct} placeholder="1" ariaLabel="Risk percentage" />
                </Field>
                <div className="col-span-2 sm:col-span-1">{entryField}</div>
              </div>
              {suggestButton}
              {stopFields}
              {tpFields}
              {advancedSection("Advanced options (currency, leverage, costs, overrides)")}
            </>
          )}
        </div>

        {/* ── Results (identical in both modes; updates live) ── */}
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
            <ResultRow
              label={<Term k="stop loss">Stop-loss distance</Term>}
              value={result.stopPips != null ? `${result.stopPips} pips` : "—"}
            />
            {result.takeProfitPips != null && (
              <ResultRow
                label={<Term k="take profit">Take-profit distance</Term>}
                value={`${result.takeProfitPips} pips`}
              />
            )}
            <ResultRow
              label={<Term k="position sizing">Recommended size</Term>}
              value={result.recommendedUnits != null ? `${result.recommendedUnits.toLocaleString()} units` : "—"}
              sub={
                result.recommendedLots != null
                  ? `${result.recommendedLots.toLocaleString(undefined, { maximumFractionDigits: 3 })} standard lots`
                  : undefined
              }
              emphasize
            />
            {result.units != null && result.units !== result.recommendedUnits && (
              <ResultRow
                label={<Term k="lot">Your override size</Term>}
                value={`${result.units.toLocaleString()} units`}
                sub={
                  result.lots != null
                    ? `${result.lots.toLocaleString(undefined, { maximumFractionDigits: 3 })} standard lots`
                    : undefined
                }
              />
            )}
            <ResultRow
              label={<Term k="pip value">Pip value</Term>}
              value={result.pipValue != null ? `${money(result.pipValue, currency)} / pip` : "—"}
            />
            <ResultRow
              label={<Term k="notional">Position value (notional)</Term>}
              value={result.notionalValue != null ? money(result.notionalValue, currency) : "—"}
            />
            <ResultRow
              label={<Term k="margin">Required margin (estimated)</Term>}
              value={result.requiredMargin != null ? money(result.requiredMargin, currency) : "—"}
              sub="Brokers may calculate margin differently"
            />
            <ResultRow
              label={<Term k="effective leverage">Effective leverage</Term>}
              value={result.effectiveLeverageLabel ?? "—"}
              sub={`Broker leverage: ${num(leverage) ?? "—"}:1`}
            />
            {result.potentialProfit != null && (
              <ResultRow label="Potential profit at target" value={money(result.potentialProfit, currency)} />
            )}
            {result.riskRewardLabel != null && (
              <ResultRow
                label={<Term k="risk-to-reward">Risk-to-reward</Term>}
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

          {withInsight && insight != null && insight.upcomingEvents.length > 0 && (
            <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
              <h3 className="text-xs font-semibold text-slate-700">
                Scheduled events for {pair} — next 48 hours
              </h3>
              <ul className="mt-1 space-y-1">
                {insight.upcomingEvents.map((e) => (
                  <li key={`${e.name}${e.eventTime}`} className="flex items-center gap-2 text-xs text-slate-600">
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                        e.impact === "HIGH"
                          ? "border-red-200 bg-red-50 text-red-800"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                      }`}
                    >
                      {e.impact === "HIGH" ? "High" : "Medium"}
                    </span>
                    <span className="font-medium">{e.currency}</span>
                    <span className="flex-1">{e.name}</span>
                    <span className="tabular-nums text-slate-400">
                      {new Date(e.eventTime).toLocaleString(undefined, {
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[10px] text-slate-400">
                Volatility and spreads may increase around releases. Context only — not a directional signal.
              </p>
            </div>
          )}

          <PairChart
            pairSymbol={pair}
            levels={{
              entry: num(entry),
              stop: num(stopPrice),
              takeProfit: num(tpPrice),
              current: insight?.rate ?? null,
            }}
          />

          {mode === "full" && saveHref && hasResult && (
            <Link
              href={`${saveHref}?pair=${encodeURIComponent(pair)}&direction=${direction}&entry=${entry}&stop=${stopPrice}&tp=${tpPrice}&risk=${riskPct}&balance=${balance}&leverage=${leverage}`}
              className="inline-block rounded-md border px-4 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              Save as Trade Plan
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
