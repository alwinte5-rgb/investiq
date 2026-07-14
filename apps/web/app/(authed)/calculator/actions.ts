"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

export interface SuggestedLevelsDto {
  stopPrice: number;
  stopPips: number;
  takeProfitPrice: number;
  takeProfitPips: number;
  basis: "atr" | "default";
  atrPips: number | null;
  rewardRatio: number;
}

export interface PairInsightDto {
  pairSymbol: string;
  rate: number | null;
  rateAsOf: string | null;
  atrPips: number | null;
  suggested: SuggestedLevelsDto | null;
}

export type InsightResult = { ok: true; data: PairInsightDto } | { ok: false; error: string };

/** Live rate + volatility-based suggested stop/TP for a pair (always editable). */
export async function getPairInsightAction(
  pairSymbol: string,
  direction: "BUY" | "SELL",
  entry?: number | null,
): Promise<InsightResult> {
  try {
    const qs = new URLSearchParams({ direction });
    if (entry != null && entry > 0) qs.set("entry", String(entry));
    const data = await apiFetch<PairInsightDto>(
      `/api/v1/pairs/${encodeURIComponent(pairSymbol.replace("/", "-"))}/insight?${qs}`,
    );
    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load pair data";
    if (/authentication required|unauthorized|\b401\b/i.test(msg)) redirect("/sign-in");
    return { ok: false, error: msg };
  }
}
