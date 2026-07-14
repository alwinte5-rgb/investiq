/**
 * Forex core — reward math: profit at target, risk-to-reward, break-even win
 * rate, and cost adjustments (spread / commission / swap). PURE.
 */

/** Potential profit at target: pip value (account ccy) × take-profit pips. */
export function potentialProfit(pipValueAccount: number, takeProfitPips: number): number {
  if (!(pipValueAccount > 0) || !(takeProfitPips > 0)) return 0;
  return pipValueAccount * takeProfitPips;
}

/** Reward ÷ risk (e.g. 2 means the "2" in 1:2). Null when either side is unusable. */
export function riskRewardRatio(riskAmount: number, rewardAmount: number): number | null {
  if (!(riskAmount > 0) || !(rewardAmount > 0)) return null;
  return rewardAmount / riskAmount;
}

/** Display form per the product spec: 2.1 → "1:2.1", 3 → "1:3". */
export function formatRiskReward(ratio: number): string {
  const rounded = Math.round(ratio * 10) / 10;
  return `1:${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded}`;
}

/**
 * Break-even win rate BEFORE costs, as a percent: risk ÷ (risk + reward).
 * Spread, commission, swap, and slippage raise the true break-even rate.
 */
export function breakEvenWinRatePct(riskAmount: number, rewardAmount: number): number | null {
  if (!(riskAmount > 0) || !(rewardAmount > 0)) return null;
  return (riskAmount / (riskAmount + rewardAmount)) * 100;
}

export interface TradeCosts {
  /** Spread in pips (charged once, on entry). */
  spreadPips?: number | null;
  /** Pip value of the position in the account currency (needed to price the spread). */
  pipValueAccount?: number | null;
  /** Commission in the account currency (round turn). */
  commission?: number | null;
  /** Swap / rollover cost in the account currency (negative = credit). */
  swap?: number | null;
}

export interface TradeCostBreakdown {
  spreadCost: number | null;
  commission: number | null;
  swap: number | null;
  total: number;
}

/** Price the entered costs in the account currency. Absent inputs stay null. */
export function tradeCosts({ spreadPips, pipValueAccount, commission, swap }: TradeCosts): TradeCostBreakdown {
  const spreadCost =
    spreadPips != null && spreadPips > 0 && pipValueAccount != null && pipValueAccount > 0
      ? spreadPips * pipValueAccount
      : null;
  const total = (spreadCost ?? 0) + (commission ?? 0) + (swap ?? 0);
  return { spreadCost, commission: commission ?? null, swap: swap ?? null, total };
}

/** Reward at target net of the entered costs (never fabricates missing costs). */
export function netReward(rewardAmount: number, costs: TradeCostBreakdown): number {
  return rewardAmount - costs.total;
}
