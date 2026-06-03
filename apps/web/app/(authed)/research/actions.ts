"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

export interface Evidence {
  id: string;
  sourceType: string;
  reference: string | null;
  role: "SUPPORTING" | "INVALIDATING";
  snapshot: { note?: string; value?: unknown } | null;
}

export interface Analysis {
  id: string;
  recommendationType: string;
  summary: string;
  bullCase: string | null;
  bearCase: string | null;
  keyRisks: string | null;
  newsImpactSummary: string | null;
  technicalSummary: string | null;
  confidenceScore: number;
  riskScore: number;
  model: string;
  generatedAt: string;
  symbol?: { ticker: string; name: string } | null;
  evidence: Evidence[];
}

export type AnalysisResult =
  | { status: "created" | "cached"; analysis: Analysis }
  | { status: "insufficient"; message: string; missing?: string[] };

export type AnalysisActionResult =
  | { ok: true; result: AnalysisResult }
  | { ok: false; error: string };

function isAuthError(msg: string) {
  return /authentication required|unauthorized|\b401\b/i.test(msg);
}

/** Generate (or reuse) an AI analysis for a ticker. */
export async function generateAnalysisAction(ticker: string): Promise<AnalysisActionResult> {
  const t = ticker.trim().toUpperCase();
  if (!t) return { ok: false, error: "Enter a ticker" };
  try {
    const result = await apiFetch<AnalysisResult>("/api/v1/analysis", {
      method: "POST",
      body: JSON.stringify({ ticker: t }),
    });
    return { ok: true, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    if (isAuthError(msg)) redirect("/sign-in");
    return { ok: false, error: msg };
  }
}

/** Latest stored analysis for a ticker, or null if none yet. */
export async function getLatestAnalysisAction(ticker: string): Promise<AnalysisActionResult> {
  const t = ticker.trim().toUpperCase();
  if (!t) return { ok: false, error: "Enter a ticker" };
  try {
    const analysis = await apiFetch<Analysis | null>(`/api/v1/symbols/${t}/analysis`);
    if (!analysis) return { ok: false, error: "No analysis yet" };
    return { ok: true, result: { status: "cached", analysis } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    if (isAuthError(msg)) redirect("/sign-in");
    return { ok: false, error: msg };
  }
}
