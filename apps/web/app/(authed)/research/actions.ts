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
export interface ArticleWithImpact {
  id: string;
  source: string;
  url: string;
  headline: string;
  summary: string | null;
  publishedAt: string;
  impact: { impact: string; rationale: string; confidence: number; generatedAt: string } | null;
}

export type NewsActionResult =
  | { ok: true; articles: ArticleWithImpact[] }
  | { ok: false; error: string; gated?: boolean };

function classifyNews(msg: string) {
  return {
    auth: /authentication required|unauthorized|\b401\b/i.test(msg),
    gated: /\b403\b|investor plan|forbidden/i.test(msg),
  };
}

/** Stored articles + impact classifications for a ticker (Investor+). */
export async function getSymbolNewsAction(ticker: string): Promise<NewsActionResult> {
  const t = ticker.trim().toUpperCase();
  if (!t) return { ok: false, error: "Enter a ticker" };
  try {
    const articles = await apiFetch<ArticleWithImpact[]>(`/api/v1/symbols/${t}/news`);
    return { ok: true, articles };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load news";
    const { auth, gated } = classifyNews(msg);
    if (auth) redirect("/sign-in");
    return { ok: false, error: msg, gated };
  }
}

/** Ingest + classify the latest news for a ticker, then return the stored set. */
export async function refreshSymbolNewsAction(ticker: string): Promise<NewsActionResult> {
  const t = ticker.trim().toUpperCase();
  if (!t) return { ok: false, error: "Enter a ticker" };
  try {
    await apiFetch(`/api/v1/symbols/${t}/news/refresh`, { method: "POST" });
    return getSymbolNewsAction(t);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to refresh news";
    const { auth, gated } = classifyNews(msg);
    if (auth) redirect("/sign-in");
    return { ok: false, error: msg, gated };
  }
}

// --- Layer 6: Risk Engine ---
export interface RiskView {
  status: "assessed" | "insufficient";
  ticker?: string;
  message?: string;
  price?: number;
  buyZoneLow?: number;
  buyZoneHigh?: number;
  stopLoss?: number;
  profitTarget?: number;
  riskReward?: number;
  positionSize?: number | null;
  maxRiskPct?: number;
  maxRiskAmount?: number | null;
  warningColor?: "GREEN" | "YELLOW" | "ORANGE" | "RED";
  warnings?: { type: string; severity: "info" | "warn"; message: string }[];
}

export type RiskActionResult = { ok: true; result: RiskView } | { ok: false; error: string };

/** Compute (and store) a trade-risk assessment for a ticker. */
export async function assessRiskAction(ticker: string): Promise<RiskActionResult> {
  const t = ticker.trim().toUpperCase();
  if (!t) return { ok: false, error: "Enter a ticker" };
  try {
    const result = await apiFetch<RiskView>(`/api/v1/symbols/${t}/risk`, { method: "POST" });
    return { ok: true, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Risk assessment failed";
    if (isAuthError(msg)) redirect("/sign-in");
    return { ok: false, error: msg };
  }
}

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
