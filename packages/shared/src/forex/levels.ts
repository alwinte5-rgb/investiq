/**
 * Forex core — suggested stop-loss / take-profit levels.
 *
 * PURE volatility math, not prediction: the stop sits a multiple of the pair's
 * recent daily true range (ATR) away from entry so normal noise is less likely
 * to clip it, and the target is placed at the user's own preferred
 * reward ratio. When no ATR is available, a conservative pip distance by pair
 * category is used. Always editable by the user; always labeled "suggested".
 */

import { pipSizeFor, priceDiffToPips } from "./pips.js";
import type { PairCategory } from "./pairs.js";
import type { TradeDirection } from "./position.js";

/** Stop distance = this multiple of ATR(14) (same spirit as the old stock engine). */
export const STOP_ATR_MULTIPLE = 1.5;

/** Fallback stop distances (pips) when no volatility data is available. */
export const DEFAULT_STOP_PIPS: Record<PairCategory, number> = {
  MAJOR: 25,
  MINOR: 40,
  EXOTIC: 80,
};

export interface SuggestedLevelsInput {
  direction: TradeDirection;
  entryPrice: number;
  pairSymbol: string;
  /** ATR(14) of daily candles, in PRICE units (e.g. 0.0065 for EUR/USD). */
  atr?: number | null;
  category?: PairCategory;
  /** The user's preferred reward ratio (the X in 1:X). Default 2. */
  preferredRewardRatio?: number | null;
}

export interface SuggestedLevels {
  stopPrice: number;
  stopPips: number;
  takeProfitPrice: number;
  takeProfitPips: number;
  /** "atr" when volatility-derived, "default" when the category fallback was used. */
  basis: "atr" | "default";
  atrPips: number | null;
  rewardRatio: number;
}

/** Compute suggested stop/TP for a prospective trade. Null when entry is unusable. */
export function suggestedLevels(input: SuggestedLevelsInput): SuggestedLevels | null {
  if (!(input.entryPrice > 0)) return null;
  const pipSize = pipSizeFor(input.pairSymbol);
  const rr = input.preferredRewardRatio != null && input.preferredRewardRatio > 0 ? input.preferredRewardRatio : 2;

  let stopDistance: number; // price units
  let basis: "atr" | "default";
  if (input.atr != null && input.atr > 0) {
    stopDistance = input.atr * STOP_ATR_MULTIPLE;
    basis = "atr";
  } else {
    stopDistance = DEFAULT_STOP_PIPS[input.category ?? "MAJOR"] * pipSize;
    basis = "default";
  }

  const tpDistance = stopDistance * rr;
  const dir = input.direction === "BUY" ? 1 : -1;
  const stopPrice = input.entryPrice - dir * stopDistance;
  const takeProfitPrice = input.entryPrice + dir * tpDistance;
  if (!(stopPrice > 0) || !(takeProfitPrice > 0)) return null;

  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    stopPrice,
    stopPips: round1(priceDiffToPips(stopDistance, pipSize)),
    takeProfitPrice,
    takeProfitPips: round1(priceDiffToPips(tpDistance, pipSize)),
    basis,
    atrPips: input.atr != null && input.atr > 0 ? round1(priceDiffToPips(input.atr, pipSize)) : null,
    rewardRatio: rr,
  };
}

/**
 * ATR(14) from daily candles (most recent first or last — order-agnostic):
 * the average of true ranges, where TR = max(high−low, |high−prevClose|,
 * |low−prevClose|). Returns null when fewer than 2 candles.
 */
export function averageTrueRange(
  candles: { high: number; low: number; close: number }[],
  period = 14,
): number | null {
  if (candles.length < 2) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;
    const prevClose = candles[i - 1]!.close;
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)));
  }
  const window = trs.slice(-period);
  if (window.length === 0) return null;
  return window.reduce((s, x) => s + x, 0) / window.length;
}
