/**
 * Forex core — risk, stop distance, pip value, and position sizing.
 *
 * The central promise of the product lives here: "know exactly how much you
 * are risking before you place the trade." All functions are PURE and account-
 * currency aware — the account currency never has to match the quote currency.
 */

import { getRate, type RateTable } from "./conversion.js";
import { pipSizeFor, priceDiffToPips, splitPair } from "./pips.js";

export type TradeDirection = "BUY" | "SELL";

export const STANDARD_LOT_UNITS = 100_000;
export const MINI_LOT_UNITS = 10_000;
export const MICRO_LOT_UNITS = 1_000;
export const NANO_LOT_UNITS = 100;

/** Dollar (account-currency) amount risked for a balance and risk percent. */
export function riskAmount(accountBalance: number, riskPercentage: number): number {
  if (!(accountBalance > 0) || !(riskPercentage > 0)) return 0;
  return accountBalance * (riskPercentage / 100);
}

export interface StopDistanceInput {
  direction: TradeDirection;
  entryPrice: number;
  stopPrice: number;
  pipSize: number;
}

export interface StopDistanceResult {
  pips: number;
  /** Set when the stop sits on the unusual side of entry for the direction. */
  directionWarning: string | null;
}

/**
 * Stop-loss distance in pips. A buy stop normally sits below entry and a sell
 * stop above; an inverted stop still computes (the trader may be intentional)
 * but returns a warning instead of blocking.
 */
export function stopLossPips({ direction, entryPrice, stopPrice, pipSize }: StopDistanceInput): StopDistanceResult {
  const pips = priceDiffToPips(entryPrice - stopPrice, pipSize);
  let directionWarning: string | null = null;
  if (direction === "BUY" && stopPrice > entryPrice) {
    directionWarning = "A buy trade's stop loss is normally below the entry price — double-check the stop direction.";
  } else if (direction === "SELL" && stopPrice < entryPrice) {
    directionWarning = "A sell trade's stop loss is normally above the entry price — double-check the stop direction.";
  } else if (stopPrice === entryPrice) {
    directionWarning = "The stop loss equals the entry price, so the stop distance is zero pips.";
  }
  return { pips, directionWarning };
}

/**
 * Take-profit distance in pips. A buy target normally sits above entry and a
 * sell target below; unusual placement warns rather than blocks.
 */
export function takeProfitPips({ direction, entryPrice, stopPrice: targetPrice, pipSize }: StopDistanceInput): StopDistanceResult {
  const pips = priceDiffToPips(entryPrice - targetPrice, pipSize);
  let directionWarning: string | null = null;
  if (direction === "BUY" && targetPrice < entryPrice) {
    directionWarning = "A buy trade's take profit is normally above the entry price — double-check the target direction.";
  } else if (direction === "SELL" && targetPrice > entryPrice) {
    directionWarning = "A sell trade's take profit is normally below the entry price — double-check the target direction.";
  }
  return { pips, directionWarning };
}

/** Resolve a stop price from a pip distance (direction-aware). */
export function stopPriceFromPips(direction: TradeDirection, entryPrice: number, pips: number, pipSize: number): number {
  const diff = Math.abs(pips) * pipSize;
  return direction === "BUY" ? entryPrice - diff : entryPrice + diff;
}

/** Resolve a take-profit price from a pip distance (direction-aware). */
export function takeProfitPriceFromPips(direction: TradeDirection, entryPrice: number, pips: number, pipSize: number): number {
  const diff = Math.abs(pips) * pipSize;
  return direction === "BUY" ? entryPrice + diff : entryPrice - diff;
}

export interface PipValueInput {
  pairSymbol: string;
  accountCurrency: string;
  rates: RateTable;
}

/**
 * Value of one pip for ONE unit of the pair, in the ACCOUNT currency.
 * One unit moving one pip changes the position by `pipSize` in the QUOTE
 * currency; that quote-currency amount is converted to the account currency.
 * Returns null when the rate table can't convert quote → account.
 */
export function pipValuePerUnit({ pairSymbol, accountCurrency, rates }: PipValueInput): number | null {
  const parts = splitPair(pairSymbol);
  if (!parts) return null;
  const pipSize = pipSizeFor(pairSymbol);
  const rate = getRate(parts.quote, accountCurrency, rates);
  return rate == null ? null : pipSize * rate;
}

/** Value of one pip for a position of `units`, in the account currency. */
export function pipValueForUnits(units: number, input: PipValueInput): number | null {
  const perUnit = pipValuePerUnit(input);
  return perUnit == null ? null : units * perUnit;
}

export interface PositionSizeInput extends PipValueInput {
  /** Amount at risk in the ACCOUNT currency. */
  riskAmount: number;
  /** Stop-loss distance in pips (must be > 0). */
  stopPips: number;
}

/**
 * Recommended position size in whole units: the size at which losing
 * `stopPips` costs exactly `riskAmount`. Floors to whole units so the true
 * risk never exceeds the requested risk. Null when inputs are unusable.
 */
export function positionSizeUnits({ riskAmount: risk, stopPips, ...pipInput }: PositionSizeInput): number | null {
  if (!(risk > 0) || !(stopPips > 0)) return null;
  const perUnit = pipValuePerUnit(pipInput);
  if (perUnit == null || !(perUnit > 0)) return null;
  return Math.floor(risk / (stopPips * perUnit));
}

/** Units → standard lots (e.g. 8000 → 0.08). */
export function unitsToLots(units: number): number {
  return units / STANDARD_LOT_UNITS;
}

/** Standard lots → units (e.g. 0.08 → 8000). */
export function lotsToUnits(lots: number): number {
  return Math.round(lots * STANDARD_LOT_UNITS);
}

export interface LotBreakdown {
  standard: number;
  mini: number;
  micro: number;
  nano: number;
}

/** A unit count expressed in each lot convention. */
export function lotBreakdown(units: number): LotBreakdown {
  return {
    standard: units / STANDARD_LOT_UNITS,
    mini: units / MINI_LOT_UNITS,
    micro: units / MICRO_LOT_UNITS,
    nano: units / NANO_LOT_UNITS,
  };
}

/** Human phrasing per the product spec: "8,000 currency units, equal to 0.08 standard lots." */
export function describeUnits(units: number): string {
  const lots = unitsToLots(units);
  const lotsStr = lots.toLocaleString("en-US", { maximumFractionDigits: 3 });
  return `${units.toLocaleString("en-US")} currency units, equal to ${lotsStr} standard lot${lots === 1 ? "" : "s"}`;
}
