/**
 * Layer 7 — Chart Intelligence (deterministic overlay builder).
 *
 * PURE assembly: turns the user's already-stored risk assessment + AI analysis +
 * scheduled events into a single chart-overlay payload that web and mobile both
 * render. No I/O, no clock dependence beyond an injectable `now`, no model calls —
 * the overlay is a faithful projection of what was already computed and stored, so
 * "what the chart shows" always matches the analysis/risk the user can read.
 *
 * Nothing here is invented: price lines come straight from the stored risk levels,
 * "Show Me Why" is the stored evidence, and events are the symbol's real earnings
 * and classified-news rows. We deliberately do NOT synthesize support/resistance
 * from data we don't have (no OHLC history exists upstream) — integrity over
 * decoration.
 */

import type { WarningColor } from "./risk.js";

export type ChartLevelKind = "BUY_ZONE_LOW" | "BUY_ZONE_HIGH" | "STOP_LOSS" | "PROFIT_TARGET";

export interface ChartLevel {
  kind: ChartLevelKind;
  price: number;
  label: string;
  /** Line color (hex) — shared by web overlay + mobile list dot. */
  color: string;
}

export type ChartEventKind = "EARNINGS" | "NEWS";
export type NewsTone = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export interface ChartEvent {
  kind: ChartEventKind;
  date: string; // ISO
  label: string;
  tone?: NewsTone; // news only
  url?: string; // news only
}

export interface ShowMeWhyItem {
  sourceType: string;
  role: "SUPPORTING" | "INVALIDATING";
  note: string | null;
}

export interface ChartOverlay {
  ticker: string;
  warningColor: WarningColor | null;
  riskReward: number | null;
  recommendationType: string | null;
  confidenceScore: number | null;
  riskScore: number | null;
  /** Horizontal price lines, ordered high → low for top-down rendering. */
  levels: ChartLevel[];
  /** Event markers, ordered oldest → newest. */
  events: ChartEvent[];
  /** Stored evidence behind the recommendation (supporting first). */
  showMeWhy: ShowMeWhyItem[];
  hasRisk: boolean;
  hasAnalysis: boolean;
  generatedAt: string;
}

/** Decoded (plain-number) risk levels from the stored RiskAssessment. */
export interface ChartRiskInput {
  buyZoneLow: number;
  buyZoneHigh: number;
  stopLoss: number;
  profitTarget: number;
  riskReward: number;
  warningColor: WarningColor;
}

export interface ChartAnalysisInput {
  recommendationType: string;
  confidenceScore: number;
  riskScore: number;
  evidence: ShowMeWhyItem[];
}

/** Level line colors — match the web/mobile risk panels. */
export const LEVEL_COLORS: Record<ChartLevelKind, string> = {
  BUY_ZONE_LOW: "#2563eb",
  BUY_ZONE_HIGH: "#2563eb",
  STOP_LOSS: "#b91c1c",
  PROFIT_TARGET: "#15803d",
};

const LEVEL_LABELS: Record<ChartLevelKind, string> = {
  BUY_ZONE_LOW: "Buy zone (low)",
  BUY_ZONE_HIGH: "Buy zone (high)",
  STOP_LOSS: "Stop loss",
  PROFIT_TARGET: "Profit target",
};

function level(kind: ChartLevelKind, price: number): ChartLevel {
  return { kind, price, label: LEVEL_LABELS[kind], color: LEVEL_COLORS[kind] };
}

/**
 * Build the chart overlay from already-stored pieces. `risk`/`analysis` are null
 * when the user hasn't generated them yet (the UI then shows an empty/partial
 * state instead of fabricating levels). Events are sorted oldest → newest;
 * evidence keeps SUPPORTING before INVALIDATING for a readable "Show Me Why".
 */
export function buildChartOverlay(args: {
  ticker: string;
  risk: ChartRiskInput | null;
  analysis: ChartAnalysisInput | null;
  events: ChartEvent[];
  now?: Date;
}): ChartOverlay {
  const { ticker, risk, analysis, events } = args;
  const now = args.now ?? new Date();

  const levels: ChartLevel[] = risk
    ? [
        level("PROFIT_TARGET", risk.profitTarget),
        level("BUY_ZONE_HIGH", risk.buyZoneHigh),
        level("BUY_ZONE_LOW", risk.buyZoneLow),
        level("STOP_LOSS", risk.stopLoss),
      ]
        // Defensive: keep strictly high → low even if stored levels are unusual.
        .sort((a, b) => b.price - a.price)
    : [];

  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const ROLE_RANK: Record<ShowMeWhyItem["role"], number> = { SUPPORTING: 0, INVALIDATING: 1 };
  const showMeWhy = analysis
    ? [...analysis.evidence].sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role])
    : [];

  return {
    ticker: ticker.toUpperCase(),
    warningColor: risk?.warningColor ?? null,
    riskReward: risk?.riskReward ?? null,
    recommendationType: analysis?.recommendationType ?? null,
    confidenceScore: analysis?.confidenceScore ?? null,
    riskScore: analysis?.riskScore ?? null,
    levels,
    events: sortedEvents,
    showMeWhy,
    hasRisk: Boolean(risk),
    hasAnalysis: Boolean(analysis),
    generatedAt: now.toISOString(),
  };
}
