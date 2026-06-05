/**
 * Layer 8 — Opportunity Engine (deterministic categorizer + scorer).
 *
 * PURE mapping: turns each of the user's STORED per-symbol analyses (L2) plus the
 * context already computed in earlier layers — whether they hold it (L1/L3), the
 * latest risk color (L6), the latest news tone (L5) — into a categorized,
 * ranked, explainable opportunity. No I/O, no model calls: every item is a
 * reproducible projection of stored data, so the lists can never claim something
 * the analysis didn't say. Educational "Watch" framing, never buy/sell directives.
 */

import type { WarningColor } from "./risk.js";
import type { RecommendationType } from "./recommendations.js";
import type { NewsTone } from "./chart.js";

export type OpportunityType = "BUY_WATCH" | "ETF" | "REBUY" | "HIGH_RISK_HOLDING" | "REVIEW" | "AVOID";

/** Render order for the opportunity sections (positive first, warnings last). */
export const OPPORTUNITY_TYPES: OpportunityType[] = [
  "BUY_WATCH",
  "ETF",
  "REBUY",
  "REVIEW",
  "HIGH_RISK_HOLDING",
  "AVOID",
];

export const OPPORTUNITY_LABELS: Record<OpportunityType, string> = {
  BUY_WATCH: "Buy Watch",
  ETF: "ETF Watch",
  REBUY: "Rebuy Watch",
  HIGH_RISK_HOLDING: "High-Risk Holdings",
  REVIEW: "Positions to Review",
  AVOID: "Avoid",
};

/** True when the opportunity is a constructive (add/watch) idea vs. a warning. */
export function isPositiveOpportunity(type: OpportunityType): boolean {
  return type === "BUY_WATCH" || type === "ETF" || type === "REBUY";
}

export interface OpportunityInput {
  ticker: string;
  name: string;
  assetType: "STOCK" | "ETF";
  recommendationType: RecommendationType;
  /** 0–100 confidence in the recommendation. */
  confidenceScore: number;
  /** 0–100 risk score. */
  riskScore: number;
  /** Whether the user currently holds the symbol. */
  held: boolean;
  /** Latest stored risk warning color, if assessed (L6). */
  warningColor?: WarningColor | null;
  /** Latest grounded news tone, if any (L5). */
  newsTone?: NewsTone | null;
  /** A representative supporting-evidence note, for the explanation. */
  evidenceNote?: string | null;
}

export interface OpportunitySupporting {
  recommendationType: RecommendationType;
  confidenceScore: number;
  riskScore: number;
  warningColor: WarningColor | null;
  newsTone: NewsTone | null;
  evidenceNote: string | null;
  held: boolean;
}

export interface Opportunity {
  ticker: string;
  name: string;
  type: OpportunityType;
  /** Ranking score within the category (0–100, higher = more relevant). */
  score: number;
  confidence: number;
  risk: number;
  explanation: string;
  supporting: OpportunitySupporting;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Map a recommendation (+ held / asset type) to an opportunity bucket, or null. */
function mapType(
  rec: RecommendationType,
  assetType: "STOCK" | "ETF",
  held: boolean,
): OpportunityType | null {
  switch (rec) {
    case "STRONG_BUY_WATCH":
    case "BUY_WATCH":
      return assetType === "ETF" ? "ETF" : "BUY_WATCH";
    case "REBUY_WATCH":
      return "REBUY";
    case "HIGH_RISK_WARNING":
      // A held risky name belongs in "high-risk holdings"; otherwise it's a warn-off.
      return held ? "HIGH_RISK_HOLDING" : "AVOID";
    case "AVOID":
      return "AVOID";
    case "TRIM_POSITION":
    case "EXIT_CONSIDERATION":
      // Only actionable on something you actually hold.
      return held ? "REVIEW" : null;
    case "HOLD":
      return null;
  }
}

const COLOR_BOOST: Record<WarningColor, number> = { GREEN: 0, YELLOW: 2, ORANGE: 5, RED: 10 };

function scoreFor(type: OpportunityType, input: OpportunityInput): number {
  const boost = input.warningColor ? COLOR_BOOST[input.warningColor] : 0;
  if (isPositiveOpportunity(type)) {
    // Reward high confidence + low risk; Strong Buy Watch gets a small edge.
    const strongBonus = input.recommendationType === "STRONG_BUY_WATCH" ? 8 : 0;
    const newsBonus = input.newsTone === "POSITIVE" ? 4 : input.newsTone === "NEGATIVE" ? -4 : 0;
    return clamp(input.confidenceScore * 0.7 + (100 - input.riskScore) * 0.3 + strongBonus + newsBonus);
  }
  // Warning buckets rank by urgency: higher risk (and worse color) first.
  return clamp(input.riskScore * 0.7 + input.confidenceScore * 0.3 + boost);
}

function explain(type: OpportunityType, input: OpportunityInput): string {
  const note = input.evidenceNote?.trim();
  const tail = note ? ` ${note.endsWith(".") ? note : `${note}.`}` : "";
  switch (type) {
    case "BUY_WATCH":
    case "ETF":
    case "REBUY":
      return (
        `${OPPORTUNITY_LABELS[type]}: ${input.confidenceScore}/100 confidence at ${input.riskScore}/100 risk.` +
        (input.newsTone === "POSITIVE" ? " Recent news skews positive." : "") +
        tail
      );
    case "HIGH_RISK_HOLDING":
      return (
        `You hold this and risk is elevated (${input.riskScore}/100` +
        (input.warningColor ? `, ${input.warningColor.toLowerCase()}` : "") +
        `).` +
        tail
      );
    case "REVIEW":
      return `Flagged to review — the latest analysis suggests reassessing this position.${tail}`;
    case "AVOID":
      return `Avoid for now — ${input.riskScore}/100 risk on the latest analysis.${tail}`;
  }
}

/** Categorize a single stored analysis into an opportunity, or null if it isn't one. */
export function categorizeOpportunity(input: OpportunityInput): Opportunity | null {
  const type = mapType(input.recommendationType, input.assetType, input.held);
  if (!type) return null;
  return {
    ticker: input.ticker.toUpperCase(),
    name: input.name,
    type,
    score: scoreFor(type, input),
    confidence: clamp(input.confidenceScore),
    risk: clamp(input.riskScore),
    explanation: explain(type, input),
    supporting: {
      recommendationType: input.recommendationType,
      confidenceScore: input.confidenceScore,
      riskScore: input.riskScore,
      warningColor: input.warningColor ?? null,
      newsTone: input.newsTone ?? null,
      evidenceNote: input.evidenceNote ?? null,
      held: input.held,
    },
  };
}

export interface OpportunityGroup {
  type: OpportunityType;
  label: string;
  items: Opportunity[];
}

/**
 * Categorize many analyses, then group by type and rank each group by score
 * (ties broken by ticker for stable output). Empty groups are omitted.
 */
export function buildOpportunities(inputs: OpportunityInput[]): OpportunityGroup[] {
  const items = inputs
    .map(categorizeOpportunity)
    .filter((o): o is Opportunity => o !== null);

  return OPPORTUNITY_TYPES.map((type) => ({
    type,
    label: OPPORTUNITY_LABELS[type],
    items: items
      .filter((o) => o.type === type)
      .sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker)),
  })).filter((g) => g.items.length > 0);
}
