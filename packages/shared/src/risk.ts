/**
 * Layer 6 — Risk Engine (deterministic core).
 *
 * PURE trade-risk math: buy zone, stop loss, profit target, reward:risk,
 * position sizing, max risk — plus a Green/Yellow/Orange/Red warning roll-up.
 * No I/O, no clock, no model calls: the same inputs always produce the same
 * output, so a stored RiskAssessment is reproducible. Educational framing —
 * "zones" and "warnings", never directives to buy or sell.
 */

export type WarningColor = "GREEN" | "YELLOW" | "ORANGE" | "RED";

export type RiskWarningType = "earnings" | "volatility" | "concentration" | "news" | "technical";

export interface RiskWarning {
  type: RiskWarningType;
  severity: "info" | "warn";
  message: string;
}

export interface RiskInput {
  /** Current price (required, must be > 0). */
  price: number;
  /** Typical swing as a percent, used to size the levels (e.g. 4 = 4%). */
  volatilityPct: number;
  /** Days until next earnings (null = unknown/none). */
  earningsInDays?: number | null;
  /** Latest grounded news sentiment for the symbol. */
  newsSentiment?: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | null;
  /** This position's share of the portfolio, if currently held. */
  heldWeightPct?: number | null;
  /** Total portfolio value, used for position sizing. */
  accountValue?: number | null;
  /** Percent of the account risked on the trade (default 1%). */
  riskPerTradePct?: number;
  /** Price has broken below the buy zone (technical breakdown). */
  belowBuyZone?: boolean;
}

export interface RiskAssessment {
  status: "assessed";
  price: number;
  buyZoneLow: number;
  buyZoneHigh: number;
  stopLoss: number;
  profitTarget: number;
  /** Reward:risk ratio (e.g. 2 = 2:1). */
  riskReward: number;
  /** Suggested share count (null when no account value is known). */
  positionSize: number | null;
  /** Percent of the account at risk on the trade. */
  maxRiskPct: number;
  /** Dollar amount at risk (null when no account value is known). */
  maxRiskAmount: number | null;
  warningColor: WarningColor;
  warnings: RiskWarning[];
}

export interface RiskInsufficient {
  status: "insufficient";
  message: string;
}

export type RiskResult = RiskAssessment | RiskInsufficient;

/** Market-typical swing used when a stock's volatility can't be derived. */
export const DEFAULT_VOLATILITY_PCT = 4;
/** Stop sits this many volatility units below entry. */
export const STOP_VOL_MULTIPLE = 1.5;
/** Target is this multiple of the entry→stop risk (reward:risk). */
export const TARGET_RR = 2;
/** Buy zone is entry ± this fraction of a volatility unit. */
export const BUY_ZONE_VOL_FRACTION = 0.25;
/** Default percent of the account risked per trade. */
export const DEFAULT_RISK_PER_TRADE_PCT = 1;
/** Earnings within this many days is flagged. */
export const EARNINGS_RISK_DAYS = 7;
/** Volatility at/above this percent is "elevated". */
export const HIGH_VOLATILITY_PCT = 6;
/** A single position at/above this share of the portfolio is "concentrated". */
export const CONCENTRATION_RISK_PCT = 25;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Compute a trade-risk assessment from a current price + volatility, plus
 * optional context (earnings, news, concentration, account size). Returns
 * `insufficient` when there's no usable price. Levels are derived from the
 * volatility "unit" so they scale with the stock; the warning color is a simple,
 * consistent roll-up of how many serious risks are present.
 */
export function assessRisk(input: RiskInput): RiskResult {
  if (!(input.price > 0)) {
    return { status: "insufficient", message: "No current price available to assess risk." };
  }

  const vol = input.volatilityPct > 0 ? input.volatilityPct : DEFAULT_VOLATILITY_PCT;
  const unit = input.price * (vol / 100); // dollar value of one volatility unit

  const buyZoneLow = round2(input.price - BUY_ZONE_VOL_FRACTION * unit);
  const buyZoneHigh = round2(input.price + BUY_ZONE_VOL_FRACTION * unit);
  const stopLoss = round2(input.price - STOP_VOL_MULTIPLE * unit);
  const riskPerShare = input.price - stopLoss; // > 0
  const profitTarget = round2(input.price + TARGET_RR * riskPerShare);
  const riskReward = round2((profitTarget - input.price) / riskPerShare);

  const maxRiskPct = input.riskPerTradePct ?? DEFAULT_RISK_PER_TRADE_PCT;
  let positionSize: number | null = null;
  let maxRiskAmount: number | null = null;
  if (input.accountValue && input.accountValue > 0 && riskPerShare > 0) {
    maxRiskAmount = round2(input.accountValue * (maxRiskPct / 100));
    positionSize = Math.max(0, Math.floor(maxRiskAmount / riskPerShare));
  }

  const warnings: RiskWarning[] = [];
  if (input.earningsInDays != null && input.earningsInDays >= 0 && input.earningsInDays <= EARNINGS_RISK_DAYS) {
    const d = input.earningsInDays;
    warnings.push({
      type: "earnings",
      severity: "warn",
      message: `Earnings in ${d === 0 ? "under a day" : `${d} day${d === 1 ? "" : "s"}`} — expect a larger move.`,
    });
  }
  if (vol >= HIGH_VOLATILITY_PCT) {
    warnings.push({
      type: "volatility",
      severity: "warn",
      message: `Elevated volatility (~${Math.round(vol)}% typical swing) — size positions smaller.`,
    });
  }
  if (input.heldWeightPct != null && input.heldWeightPct >= CONCENTRATION_RISK_PCT) {
    warnings.push({
      type: "concentration",
      severity: "warn",
      message: `This position is ${Math.round(input.heldWeightPct)}% of your portfolio — concentrated.`,
    });
  }
  if (input.newsSentiment === "NEGATIVE") {
    warnings.push({
      type: "news",
      severity: "warn",
      message: "Recent news skews negative — confirm the thesis before adding.",
    });
  } else if (input.newsSentiment === "POSITIVE") {
    warnings.push({ type: "news", severity: "info", message: "Recent news skews positive." });
  }
  if (input.belowBuyZone) {
    warnings.push({
      type: "technical",
      severity: "warn",
      message: "Price is below the buy zone — wait for it to stabilize.",
    });
  }

  const serious = warnings.filter((w) => w.severity === "warn").length;
  const warningColor: WarningColor =
    serious === 0 ? "GREEN" : serious === 1 ? "YELLOW" : serious === 2 ? "ORANGE" : "RED";

  return {
    status: "assessed",
    price: round2(input.price),
    buyZoneLow,
    buyZoneHigh,
    stopLoss,
    profitTarget,
    riskReward,
    positionSize,
    maxRiskPct,
    maxRiskAmount,
    warningColor,
    warnings,
  };
}

/** Derive a volatility percent from beta (market beta ≈ 1 → ~market swing). */
export function volatilityFromBeta(beta: number | null | undefined): number {
  if (beta == null || !(beta > 0)) return DEFAULT_VOLATILITY_PCT;
  const v = beta * DEFAULT_VOLATILITY_PCT;
  return Math.max(2, Math.min(15, Math.round(v * 10) / 10));
}
