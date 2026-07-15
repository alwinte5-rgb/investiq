/**
 * Forex core — the full trade-calculation orchestrator.
 *
 * ONE function turns raw trade inputs into every number the product shows
 * (risk, pips, size, pip value, notional, margin, leverage, profit, R:R,
 * break-even, costs, status, plain-language summary). The dashboard quick
 * calculator, the full Trade Calculator page, the Trade Planner check, and the
 * API service all call this — the math is never duplicated in UI code.
 */

import { type RateTable } from "./conversion.js";
import { formatLeverage, effectiveLeverage, notionalValue, requiredMargin } from "./margin.js";
import { normalizePair, pipSizeFor, splitPair } from "./pips.js";
import {
  lotsToUnits,
  pipValueForUnits,
  pipValuePerUnit,
  positionSizeUnits,
  riskAmount,
  stopLossPips,
  stopPriceFromPips,
  takeProfitPips,
  takeProfitPriceFromPips,
  unitsToLots,
  describeUnits,
  type TradeDirection,
} from "./position.js";
import { evaluateRiskStatus, type RiskStatusResult } from "./status.js";
import {
  breakEvenWinRatePct,
  formatRiskReward,
  netReward,
  potentialProfit,
  riskRewardRatio,
  tradeCosts,
  type TradeCostBreakdown,
} from "./trade.js";

export interface TradeCalcInput {
  accountBalance: number;
  accountCurrency: string;
  pairSymbol: string;
  direction: TradeDirection;
  entryPrice: number;
  /** Stop as a price OR a pip distance (price wins when both are given). */
  stopLossPrice?: number | null;
  stopLossPips?: number | null;
  /** Take profit as a price OR a pip distance (price wins when both are given). */
  takeProfitPrice?: number | null;
  takeProfitPips?: number | null;
  riskPercentage: number;
  leverage: number;
  /** Manual size overrides — when set, the ACTUAL risk is recomputed from them. */
  positionUnitsOverride?: number | null;
  lotSizeOverride?: number | null;
  /**
   * Extra conversion rates (cross-currency accounts). The pair's own rate
   * defaults to the entry price and does not need to be supplied.
   */
  rates?: RateTable;
  /** Optional costs. */
  spreadPips?: number | null;
  commission?: number | null;
  swap?: number | null;
  /** Plan settings used for the status evaluation. */
  defaultRiskPct?: number | null;
  maxRiskPct?: number | null;
  preferredRewardRatio?: number | null;
  highImpactEventSoon?: boolean;
  eventBlockEnabled?: boolean;
}

export interface TradeCalcResult {
  status: RiskStatusResult;
  /** Non-blocking warnings (e.g. stop on the unusual side of entry). */
  warnings: string[];
  pairSymbol: string | null;
  pipSize: number | null;
  resolvedStopPrice: number | null;
  resolvedTakeProfitPrice: number | null;
  stopPips: number | null;
  takeProfitPips: number | null;
  /** The risk budget selected via risk % (account currency). */
  maxSelectedRiskAmount: number | null;
  /** The risk actually taken after any size override (account currency). */
  actualRiskAmount: number | null;
  actualRiskPct: number | null;
  recommendedUnits: number | null;
  recommendedLots: number | null;
  /** Final size after overrides. */
  units: number | null;
  lots: number | null;
  /** Pip value of the FINAL position, account currency. */
  pipValue: number | null;
  notionalValue: number | null;
  /** Estimated — brokers may compute margin differently. */
  requiredMargin: number | null;
  effectiveLeverage: number | null;
  effectiveLeverageLabel: string | null;
  potentialProfit: number | null;
  riskReward: number | null;
  riskRewardLabel: string | null;
  breakEvenWinRatePct: number | null;
  costs: TradeCostBreakdown;
  netPotentialProfit: number | null;
  /** Dynamic plain-language explanation of the trade. */
  summary: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;
/** Pip values can be fractions of a cent — keep four decimals. */
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${round2(amount).toLocaleString("en-US")} ${currency}`;
  }
}

/** Compute everything the product shows for a prospective trade. */
export function computeTradeCalc(input: TradeCalcInput): TradeCalcResult {
  const warnings: string[] = [];
  const missing: string[] = [];

  const pairSymbol = normalizePair(input.pairSymbol);
  const parts = pairSymbol ? splitPair(pairSymbol) : null;
  if (!pairSymbol || !parts) missing.push("a valid currency pair");
  if (!(input.accountBalance > 0)) missing.push("an account balance greater than zero");
  if (!(input.entryPrice > 0)) missing.push("an entry price greater than zero");
  if (!(input.riskPercentage > 0)) missing.push("a risk percentage greater than zero");
  if (!(input.leverage > 0)) missing.push("a broker leverage greater than zero");

  const pipSize = pairSymbol ? pipSizeFor(pairSymbol) : null;

  // Rate table: the trade's own entry price is always usable as the pair rate.
  const rates: RateTable = { ...(input.rates ?? {}) };
  if (pairSymbol && input.entryPrice > 0 && rates[pairSymbol] == null) rates[pairSymbol] = input.entryPrice;

  // ── Resolve stop and target (price wins over pips when both provided) ──────
  let resolvedStopPrice: number | null = null;
  let stopPips: number | null = null;
  if (pairSymbol && pipSize && input.entryPrice > 0) {
    if (input.stopLossPrice != null && input.stopLossPrice > 0) {
      resolvedStopPrice = input.stopLossPrice;
      const r = stopLossPips({
        direction: input.direction,
        entryPrice: input.entryPrice,
        stopPrice: input.stopLossPrice,
        pipSize,
      });
      stopPips = round1(r.pips);
      if (r.directionWarning) warnings.push(r.directionWarning);
    } else if (input.stopLossPips != null && input.stopLossPips > 0) {
      stopPips = round1(input.stopLossPips);
      resolvedStopPrice = stopPriceFromPips(input.direction, input.entryPrice, input.stopLossPips, pipSize);
    }
  }
  if (stopPips == null || !(stopPips > 0)) missing.push("a stop-loss price or pip distance");

  let resolvedTakeProfitPrice: number | null = null;
  let tpPips: number | null = null;
  if (pairSymbol && pipSize && input.entryPrice > 0) {
    if (input.takeProfitPrice != null && input.takeProfitPrice > 0) {
      resolvedTakeProfitPrice = input.takeProfitPrice;
      const r = takeProfitPips({
        direction: input.direction,
        entryPrice: input.entryPrice,
        stopPrice: input.takeProfitPrice,
        pipSize,
      });
      tpPips = round1(r.pips);
      if (r.directionWarning) warnings.push(r.directionWarning);
    } else if (input.takeProfitPips != null && input.takeProfitPips > 0) {
      tpPips = round1(input.takeProfitPips);
      resolvedTakeProfitPrice = takeProfitPriceFromPips(input.direction, input.entryPrice, input.takeProfitPips, pipSize);
    }
  }

  // ── Sizing ─────────────────────────────────────────────────────────────────
  const maxSelectedRiskAmount =
    input.accountBalance > 0 && input.riskPercentage > 0
      ? round2(riskAmount(input.accountBalance, input.riskPercentage))
      : null;

  const pipInput = pairSymbol ? { pairSymbol, accountCurrency: input.accountCurrency, rates } : null;
  const perUnitPipValue = pipInput ? pipValuePerUnit(pipInput) : null;
  if (pipInput && perUnitPipValue == null) {
    missing.push(`an exchange rate to convert ${parts?.quote ?? "the quote currency"} into ${input.accountCurrency}`);
  }

  const recommendedUnits =
    pipInput && maxSelectedRiskAmount != null && stopPips != null && stopPips > 0
      ? positionSizeUnits({ riskAmount: maxSelectedRiskAmount, stopPips, ...pipInput })
      : null;

  let units: number | null = recommendedUnits;
  let overridden = false;
  if (input.lotSizeOverride != null && input.lotSizeOverride > 0) {
    units = lotsToUnits(input.lotSizeOverride);
    overridden = true;
  } else if (input.positionUnitsOverride != null && input.positionUnitsOverride > 0) {
    units = Math.floor(input.positionUnitsOverride);
    overridden = true;
  }

  const positionValid = units != null && units > 0;
  if (recommendedUnits != null && recommendedUnits === 0 && !overridden) {
    warnings.push(
      "At this risk budget and stop distance, the recommended size rounds down to zero units — widen the risk budget or tighten the stop."
    );
  }

  const pipValue = pipInput && units != null && units > 0 ? pipValueForUnits(units, pipInput) : null;

  // ── Risk actually taken (recomputed after overrides, per spec) ─────────────
  const actualRiskAmount =
    pipValue != null && stopPips != null && stopPips > 0 ? round2(pipValue * stopPips) : null;
  const actualRiskPct =
    actualRiskAmount != null && input.accountBalance > 0
      ? round2((actualRiskAmount / input.accountBalance) * 100)
      : null;
  if (overridden && actualRiskAmount != null && maxSelectedRiskAmount != null && actualRiskAmount > maxSelectedRiskAmount) {
    warnings.push(
      `Your manual position size risks ${formatMoney(actualRiskAmount, input.accountCurrency)}, more than the ${formatMoney(
        maxSelectedRiskAmount,
        input.accountCurrency
      )} your risk percentage selects.`
    );
  }

  // ── Exposure ───────────────────────────────────────────────────────────────
  const notional =
    pairSymbol && units != null && units > 0
      ? notionalValue({ pairSymbol, units, rates, accountCurrency: input.accountCurrency })
      : null;
  const margin = notional != null && input.leverage > 0 ? requiredMargin(notional, input.leverage) : null;
  const effLev = notional != null && input.accountBalance > 0 ? effectiveLeverage(notional, input.accountBalance) : null;

  // ── Reward ─────────────────────────────────────────────────────────────────
  const profit =
    pipValue != null && tpPips != null && tpPips > 0 ? round2(potentialProfit(pipValue, tpPips)) : null;
  const rr = actualRiskAmount != null && profit != null ? riskRewardRatio(actualRiskAmount, profit) : null;
  const beWinRate = actualRiskAmount != null && profit != null ? breakEvenWinRatePct(actualRiskAmount, profit) : null;

  const costs = tradeCosts({
    spreadPips: input.spreadPips,
    pipValueAccount: pipValue,
    commission: input.commission,
    swap: input.swap,
  });
  const netProfit = profit != null ? round2(netReward(profit, costs)) : null;

  // ── Status ─────────────────────────────────────────────────────────────────
  const status = evaluateRiskStatus({
    missingInputs: missing,
    actualRiskPct,
    defaultRiskPct: input.defaultRiskPct ?? null,
    maxRiskPct: input.maxRiskPct ?? null,
    actualRiskAmount,
    accountBalance: input.accountBalance > 0 ? input.accountBalance : null,
    stopDefined: stopPips != null && stopPips > 0,
    positionValid,
    requiredMargin: margin,
    effectiveLeverage: effLev,
    rewardRatio: rr,
    preferredRewardRatio: input.preferredRewardRatio ?? null,
    highImpactEventSoon: input.highImpactEventSoon,
    eventBlockEnabled: input.eventBlockEnabled,
  });

  // ── Plain-language summary (updates dynamically with the numbers) ──────────
  let summary: string | null = null;
  if (pairSymbol && units != null && units > 0 && notional != null && actualRiskAmount != null) {
    const pieces = [
      `You are controlling approximately ${formatMoney(notional, input.accountCurrency)} worth of ${pairSymbol} (${describeUnits(
        units
      )}) while risking approximately ${formatMoney(actualRiskAmount, input.accountCurrency)} if your stop loss is executed at the selected price.`,
    ];
    if (margin != null) {
      pieces.push(
        `At ${formatLeverage(input.leverage)} leverage, the estimated margin requirement is approximately ${formatMoney(
          margin,
          input.accountCurrency
        )}. The margin requirement is not your maximum loss.`
      );
    }
    if (profit != null && rr != null) {
      pieces.push(
        `If the market reaches your target, the estimated profit is approximately ${formatMoney(
          profit,
          input.accountCurrency
        )} — a risk-to-reward ratio of ${formatRiskReward(rr)}.`
      );
    }
    summary = pieces.join(" ");
  }

  return {
    status,
    warnings,
    pairSymbol,
    pipSize,
    resolvedStopPrice,
    resolvedTakeProfitPrice,
    stopPips,
    takeProfitPips: tpPips,
    maxSelectedRiskAmount,
    actualRiskAmount,
    actualRiskPct,
    recommendedUnits,
    recommendedLots: recommendedUnits != null ? unitsToLots(recommendedUnits) : null,
    units,
    lots: units != null ? unitsToLots(units) : null,
    pipValue: pipValue != null ? round4(pipValue) : null,
    notionalValue: notional != null ? round2(notional) : null,
    requiredMargin: margin != null ? round2(margin) : null,
    effectiveLeverage: effLev != null ? round2(effLev) : null,
    effectiveLeverageLabel: effLev != null ? formatLeverage(effLev) : null,
    potentialProfit: profit,
    riskReward: rr != null ? round2(rr) : null,
    riskRewardLabel: rr != null ? formatRiskReward(rr) : null,
    breakEvenWinRatePct: beWinRate != null ? round1(beWinRate) : null,
    costs,
    netPotentialProfit: netProfit,
    summary,
  };
}
