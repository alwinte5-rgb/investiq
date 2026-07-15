/**
 * Forex core — risk-status evaluation for a planned trade.
 *
 * Statuses are educational judgments against the USER'S OWN plan settings,
 * never market predictions. The word "safe" is deliberately never used.
 */

export type RiskStatus = "WITHIN_PLAN" | "CAUTION" | "OUTSIDE_PLAN" | "MISSING_INFO";

export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  WITHIN_PLAN: "Within Plan",
  CAUTION: "Caution",
  OUTSIDE_PLAN: "Outside Plan",
  MISSING_INFO: "Missing Information",
};

/** Effective leverage at/above this is flagged as elevated (Caution). */
export const ELEVATED_EFFECTIVE_LEVERAGE = 20;

export interface RiskStatusInput {
  /** Required inputs present? (entry, balance, risk %, a stop, a valid pair) */
  missingInputs: string[];
  /** Actual risk as a percent of the account. */
  actualRiskPct: number | null;
  /** The user's default per-trade risk limit (percent). */
  defaultRiskPct: number | null;
  /** The user's maximum per-trade risk limit (percent). */
  maxRiskPct: number | null;
  /** Actual risk amount in the account currency. */
  actualRiskAmount: number | null;
  accountBalance: number | null;
  stopDefined: boolean;
  /** Position size resolved to a positive whole number of units? */
  positionValid: boolean;
  requiredMargin: number | null;
  effectiveLeverage: number | null;
  /** Reward ratio (the X in 1:X), when a target is set. */
  rewardRatio: number | null;
  /** The user's preferred minimum reward ratio. */
  preferredRewardRatio: number | null;
  /** A high-impact economic event is approaching for the pair's currencies. */
  highImpactEventSoon?: boolean;
  /** User's hard rule: an approaching event makes the trade OUTSIDE_PLAN, not CAUTION. */
  eventBlockEnabled?: boolean;
}

export interface RiskStatusResult {
  status: RiskStatus;
  label: string;
  /** Plain-language reasons the status was assigned (shown next to the badge). */
  reasons: string[];
}

/**
 * Evaluate a planned trade against the user's own limits.
 * OUTSIDE_PLAN > CAUTION > WITHIN_PLAN; incomplete inputs short-circuit to
 * MISSING_INFO. Reasons accumulate so the user sees every trigger, not just
 * the worst one.
 */
export function evaluateRiskStatus(input: RiskStatusInput): RiskStatusResult {
  if (input.missingInputs.length > 0) {
    return {
      status: "MISSING_INFO",
      label: RISK_STATUS_LABELS.MISSING_INFO,
      reasons: input.missingInputs.map((m) => `Missing: ${m}`),
    };
  }

  const outside: string[] = [];
  const caution: string[] = [];

  if (!input.stopDefined) outside.push("No stop loss is defined.");
  if (!input.positionValid) outside.push("The position size is invalid.");
  if (input.actualRiskPct != null && input.maxRiskPct != null && input.actualRiskPct > input.maxRiskPct) {
    outside.push(`Risk (${input.actualRiskPct.toFixed(2)}%) exceeds your maximum limit of ${input.maxRiskPct}%.`);
  }
  if (input.requiredMargin != null && input.accountBalance != null && input.requiredMargin > input.accountBalance) {
    outside.push("The estimated margin requirement exceeds your account balance.");
  }
  if (input.actualRiskAmount != null && input.accountBalance != null && input.actualRiskAmount > input.accountBalance) {
    outside.push("The stop-loss risk exceeds your entire account balance.");
  }

  if (
    input.actualRiskPct != null &&
    input.defaultRiskPct != null &&
    input.actualRiskPct > input.defaultRiskPct &&
    (input.maxRiskPct == null || input.actualRiskPct <= input.maxRiskPct)
  ) {
    caution.push(
      `Risk (${input.actualRiskPct.toFixed(2)}%) is above your default limit of ${input.defaultRiskPct}%.`
    );
  }
  if (input.effectiveLeverage != null && input.effectiveLeverage >= ELEVATED_EFFECTIVE_LEVERAGE) {
    caution.push(`Effective leverage is elevated (${input.effectiveLeverage.toFixed(1)}:1).`);
  }
  if (
    input.rewardRatio != null &&
    input.preferredRewardRatio != null &&
    input.rewardRatio < input.preferredRewardRatio
  ) {
    caution.push(
      `Reward ratio (1:${input.rewardRatio.toFixed(1)}) is below your preferred minimum of 1:${input.preferredRewardRatio}.`
    );
  }
  if (input.highImpactEventSoon) {
    if (input.eventBlockEnabled) {
      outside.push(
        "A high-impact economic event is inside your warning window, and your settings treat that as outside plan.",
      );
    } else {
      caution.push("A high-impact economic event is approaching — volatility and spreads may increase.");
    }
  }

  if (outside.length > 0) {
    return { status: "OUTSIDE_PLAN", label: RISK_STATUS_LABELS.OUTSIDE_PLAN, reasons: [...outside, ...caution] };
  }
  if (caution.length > 0) {
    return { status: "CAUTION", label: RISK_STATUS_LABELS.CAUTION, reasons: caution };
  }
  return {
    status: "WITHIN_PLAN",
    label: RISK_STATUS_LABELS.WITHIN_PLAN,
    reasons: ["Risk, stop, position size, and margin all fit your plan settings."],
  };
}
