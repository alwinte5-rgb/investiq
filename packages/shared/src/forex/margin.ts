/**
 * Forex core — notional exposure, margin, and leverage.
 *
 * Margin is ESTIMATED (brokers differ); the product must always distinguish
 * "margin the broker reserves" from "money you can lose", and broker leverage
 * from the effective leverage the position actually creates.
 */

import { getRate, type RateTable } from "./conversion.js";
import { splitPair } from "./pips.js";

export interface NotionalInput {
  pairSymbol: string;
  units: number;
  /** Rate table; should at least contain the pair itself (e.g. its entry price). */
  rates: RateTable;
  accountCurrency: string;
}

/**
 * Total market exposure of the position in the ACCOUNT currency. A position of
 * `units` controls `units` of the BASE currency; that base amount is converted
 * to the account currency. Null when the rate table can't convert.
 */
export function notionalValue({ pairSymbol, units, rates, accountCurrency }: NotionalInput): number | null {
  const parts = splitPair(pairSymbol);
  if (!parts || !(units > 0)) return null;
  const rate = getRate(parts.base, accountCurrency, rates);
  return rate == null ? null : units * rate;
}

/** Estimated margin the broker reserves: notional ÷ leverage. */
export function requiredMargin(notional: number, leverage: number): number | null {
  if (!(notional > 0) || !(leverage > 0)) return null;
  return notional / leverage;
}

/** Effective leverage actually taken on: notional ÷ account equity. */
export function effectiveLeverage(notional: number, accountEquity: number): number | null {
  if (!(notional > 0) || !(accountEquity > 0)) return null;
  return notional / accountEquity;
}

/** Equity left after the estimated margin is set aside. */
export function freeMargin(accountEquity: number, marginRequired: number): number {
  return accountEquity - marginRequired;
}

/** Format a leverage ratio for display, e.g. 50 → "50:1", 7.43 → "7.4:1". */
export function formatLeverage(ratio: number): string {
  const rounded = ratio >= 10 ? Math.round(ratio) : Math.round(ratio * 10) / 10;
  return `${rounded}:1`;
}
