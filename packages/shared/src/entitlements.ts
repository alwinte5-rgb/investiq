/**
 * Central entitlements / plan gating. Checked SERVER-SIDE after auth on every
 * gated route. Never gate features in the UI alone.
 */
export const PLANS = ["FREE", "INVESTOR", "INVESTOR_PLUS"] as const;
export type Plan = (typeof PLANS)[number];

export interface Entitlements {
  maxConnectedAccounts: number;
  maxWatchlists: number;
  /** AI analyses allowed per billing period; null = unlimited. */
  aiAnalysesPerPeriod: number | null;
  portfolioIntelligence: boolean; // L3
  dailyReviews: boolean; // L4
  newsIntelligence: boolean; // L5
  opportunities: boolean; // L8
  multiplePortfolios: boolean;
  advancedAnalysis: boolean;
  historicalPatternEngine: boolean;
  priorityAlerts: boolean;
}

const FREE: Entitlements = {
  maxConnectedAccounts: 1,
  maxWatchlists: 1,
  aiAnalysesPerPeriod: 10,
  portfolioIntelligence: false,
  dailyReviews: false,
  newsIntelligence: false,
  opportunities: false,
  multiplePortfolios: false,
  advancedAnalysis: false,
  historicalPatternEngine: false,
  priorityAlerts: false,
};

const INVESTOR: Entitlements = {
  ...FREE,
  maxConnectedAccounts: 3,
  maxWatchlists: Number.POSITIVE_INFINITY,
  aiAnalysesPerPeriod: 300,
  portfolioIntelligence: true,
  dailyReviews: true,
  newsIntelligence: true,
  opportunities: true,
};

const INVESTOR_PLUS: Entitlements = {
  ...INVESTOR,
  maxConnectedAccounts: 10,
  aiAnalysesPerPeriod: null,
  multiplePortfolios: true,
  advancedAnalysis: true,
  historicalPatternEngine: true,
  priorityAlerts: true,
};

const TABLE: Record<Plan, Entitlements> = {
  FREE,
  INVESTOR,
  INVESTOR_PLUS,
};

export function entitlementsFor(plan: Plan): Entitlements {
  return TABLE[plan];
}

/** Returns true if the user is still under their AI analysis quota. */
export function withinAiQuota(plan: Plan, usedThisPeriod: number): boolean {
  const limit = entitlementsFor(plan).aiAnalysesPerPeriod;
  return limit === null || usedThisPeriod < limit;
}
