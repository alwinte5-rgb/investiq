/**
 * Allowed AI recommendation types. InvestIQ is EDUCATIONAL / NON-ADVISORY:
 * we never emit raw BUY/SELL directives. This enum is the single source of
 * truth used by the AI output validator, the DB enum, and the UI.
 */
export const RECOMMENDATION_TYPES = [
  "STRONG_BUY_WATCH",
  "BUY_WATCH",
  "HOLD",
  "TRIM_POSITION",
  "EXIT_CONSIDERATION",
  "HIGH_RISK_WARNING",
  "AVOID",
  "REBUY_WATCH",
] as const;

export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export function isRecommendationType(v: unknown): v is RecommendationType {
  return typeof v === "string" && (RECOMMENDATION_TYPES as readonly string[]).includes(v);
}

/** Human-facing labels. */
export const RECOMMENDATION_LABELS: Record<RecommendationType, string> = {
  STRONG_BUY_WATCH: "Strong Buy Watch",
  BUY_WATCH: "Buy Watch",
  HOLD: "Hold",
  TRIM_POSITION: "Trim Position",
  EXIT_CONSIDERATION: "Exit Consideration",
  HIGH_RISK_WARNING: "High Risk Warning",
  AVOID: "Avoid",
  REBUY_WATCH: "Rebuy Watch",
};

/**
 * Tokens that must NEVER appear in AI output — they imply a personalized,
 * directive (advisory) action. The output validator rejects any analysis
 * containing these. Keep lowercase; matching is case-insensitive.
 */
export const FORBIDDEN_DIRECTIVE_PATTERNS: RegExp[] = [
  /\bbuy now\b/i,
  /\bsell now\b/i,
  /\byou should (buy|sell)\b/i,
  /\b(i|we) recommend (buying|selling)\b/i,
  /\bguaranteed\b/i,
  /\bwill (definitely|certainly) (rise|fall|go up|go down)\b/i,
];

/** The exact string returned when the evidence bundle is incomplete. */
export const INSUFFICIENT_DATA_MESSAGE =
  "Not enough data available to generate a recommendation.";
