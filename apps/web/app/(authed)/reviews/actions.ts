"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

export type ReviewPeriod = "MORNING" | "WEEKLY" | "MONTHLY";

export interface ReviewFlag {
  type: string;
  severity: "info" | "warn";
  title: string;
  detail: string;
  tickers?: string[];
}

export interface ReviewContent {
  period: ReviewPeriod;
  asOf: string;
  headline: string;
  summary: string;
  healthScore: number;
  riskScore: number;
  diversificationScore: number;
  cashScore: number;
  totalValue: number;
  cashPct: number;
  topSectors: { sector: string; pct: number }[];
  flags: ReviewFlag[];
  healthDelta?: number | null;
  topMovers?: { ticker: string; changePct: number }[];
  newsHighlights?: { ticker: string; headline: string; impact: "POSITIVE" | "NEUTRAL" | "NEGATIVE" }[];
}

export interface StoredReview {
  id: string;
  period: ReviewPeriod;
  periodKey: string;
  content: ReviewContent;
  generatedAt: string;
}

export type GenerateReviewResult =
  | { status: "created" | "exists"; review: StoredReview; content?: ReviewContent }
  | { status: "insufficient"; message: string; holdingsCount: number };

export type ReviewActionResult =
  | { ok: true; result: GenerateReviewResult }
  | { ok: false; error: string; gated?: boolean };

function classify(msg: string) {
  return {
    auth: /authentication required|unauthorized|\b401\b/i.test(msg),
    gated: /\b403\b|investor plan|forbidden/i.test(msg),
  };
}

export async function generateReviewAction(period: ReviewPeriod): Promise<ReviewActionResult> {
  try {
    const result = await apiFetch<GenerateReviewResult>(
      `/api/v1/portfolio/reviews?period=${period}`,
      { method: "POST" },
    );
    return { ok: true, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to generate review";
    const { auth, gated } = classify(msg);
    if (auth) redirect("/sign-in");
    return { ok: false, error: msg, gated };
  }
}
