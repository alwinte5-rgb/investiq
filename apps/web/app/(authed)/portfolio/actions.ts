"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

export interface SectorWeight {
  sector: string;
  pct: number;
}

export interface PortfolioScores {
  status: "scored";
  healthScore: number;
  riskScore: number;
  diversificationScore: number;
  cashScore: number;
  totalValue: number;
  invested: number;
  cash: number;
  cashPct: number;
  holdingsCount: number;
  sectorConcentration: SectorWeight[];
  overweight: SectorWeight[];
  underweight: SectorWeight[];
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  id: string;
  generatedAt: string;
}

export type PortfolioResult =
  | { status: "scored"; analysis: PortfolioScores }
  | { status: "insufficient"; message: string; holdingsCount: number };

export type PortfolioActionResult =
  | { ok: true; result: PortfolioResult }
  | { ok: false; error: string; gated?: boolean };

function classify(msg: string): { auth: boolean; gated: boolean } {
  return {
    auth: /authentication required|unauthorized|\b401\b/i.test(msg),
    gated: /\b403\b|investor plan|forbidden/i.test(msg),
  };
}

/** Recompute the portfolio analysis from current holdings (Investor+). */
export async function generatePortfolioAction(): Promise<PortfolioActionResult> {
  try {
    const result = await apiFetch<PortfolioResult>("/api/v1/portfolio/analysis", {
      method: "POST",
    });
    return { ok: true, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to analyze portfolio";
    const { auth, gated } = classify(msg);
    if (auth) redirect("/sign-in");
    return { ok: false, error: msg, gated };
  }
}

// --- Layer 6: portfolio-level risk ---
export interface HoldingRiskView {
  ticker: string;
  name: string;
  weightPct: number;
  warningColor: "GREEN" | "YELLOW" | "ORANGE" | "RED";
  warnings: { type: string; severity: "info" | "warn"; message: string }[];
}
export type PortfolioRiskView =
  | {
      status: "assessed";
      overallColor: "GREEN" | "YELLOW" | "ORANGE" | "RED";
      assessedAt: string;
      holdings: HoldingRiskView[];
    }
  | { status: "insufficient"; message: string };

export type PortfolioRiskActionResult =
  | { ok: true; result: PortfolioRiskView }
  | { ok: false; error: string };

/** Per-holding risk roll-up for the connected portfolio (stored data only). */
export async function getPortfolioRiskAction(): Promise<PortfolioRiskActionResult> {
  try {
    const result = await apiFetch<PortfolioRiskView>("/api/v1/portfolio/risk");
    return { ok: true, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load portfolio risk";
    if (/authentication required|unauthorized|\b401\b/i.test(msg)) redirect("/sign-in");
    return { ok: false, error: msg };
  }
}
