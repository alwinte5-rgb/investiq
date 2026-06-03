/**
 * News impact classification (Layer 5 — News Intelligence). Single source of
 * truth shared by the AI validator, the DB enum, and the UI. The classification
 * is EDUCATIONAL: it describes a news item's likely impact on a ticker, grounded
 * only in the article text — never a directive to act.
 */
export const NEWS_IMPACT_TYPES = ["POSITIVE", "NEUTRAL", "NEGATIVE"] as const;

export type NewsImpactType = (typeof NEWS_IMPACT_TYPES)[number];

export function isNewsImpactType(v: unknown): v is NewsImpactType {
  return typeof v === "string" && (NEWS_IMPACT_TYPES as readonly string[]).includes(v);
}

export const NEWS_IMPACT_LABELS: Record<NewsImpactType, string> = {
  POSITIVE: "Positive",
  NEUTRAL: "Neutral",
  NEGATIVE: "Negative",
};
