"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

export type OpportunityType =
  | "BUY_WATCH"
  | "ETF"
  | "REBUY"
  | "HIGH_RISK_HOLDING"
  | "REVIEW"
  | "AVOID"
  | "WATCHING";

export interface Opportunity {
  ticker: string;
  name: string;
  type: OpportunityType;
  score: number;
  confidence: number;
  risk: number;
  explanation: string;
  supporting: {
    recommendationType: string;
    confidenceScore: number;
    riskScore: number;
    warningColor: "GREEN" | "YELLOW" | "ORANGE" | "RED" | null;
    newsTone: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | null;
    evidenceNote: string | null;
    held: boolean;
  };
}

export interface OpportunityGroup {
  type: OpportunityType;
  label: string;
  items: Opportunity[];
}

export type OpportunityActionResult =
  | { ok: true; groups: OpportunityGroup[] }
  | { ok: false; error: string; gated?: boolean };

function classify(msg: string): { auth: boolean; gated: boolean } {
  return {
    auth: /authentication required|unauthorized|\b401\b/i.test(msg),
    gated: /\b403\b|investor plan|forbidden/i.test(msg),
  };
}

/** Read the latest stored opportunity set (Investor+). */
export async function getOpportunitiesAction(): Promise<OpportunityActionResult> {
  try {
    const groups = await apiFetch<OpportunityGroup[]>("/api/v1/opportunities");
    return { ok: true, groups };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load opportunities";
    const { auth, gated } = classify(msg);
    if (auth) redirect("/sign-in");
    return { ok: false, error: msg, gated };
  }
}

/** Recompute opportunities from the user's stored analyses + context (Investor+). */
export async function generateOpportunitiesAction(): Promise<OpportunityActionResult> {
  try {
    const groups = await apiFetch<OpportunityGroup[]>("/api/v1/opportunities", { method: "POST" });
    return { ok: true, groups };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to refresh opportunities";
    const { auth, gated } = classify(msg);
    if (auth) redirect("/sign-in");
    return { ok: false, error: msg, gated };
  }
}
