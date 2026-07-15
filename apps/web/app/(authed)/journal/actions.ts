"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

/** Serialized JournalEntry row (Prisma Decimals arrive as strings via JSON). */
export interface JournalRow {
  id: string;
  tradePlanId: string | null;
  direction: "BUY" | "SELL";
  plannedEntry: string | null;
  actualEntry: string | null;
  plannedExit: string | null;
  actualExit: string | null;
  plannedStop: string | null;
  actualStop: string | null;
  plannedTarget: string | null;
  actualTarget: string | null;
  plannedUnits: number | null;
  actualUnits: number | null;
  plannedRisk: string | null;
  actualRisk: string | null;
  profitLossAmount: string | null;
  profitLossPips: string | null;
  rMultiple: string | null;
  session: string | null;
  strategyTag: string | null;
  rulesFollowed: boolean | null;
  emotionalState: string | null;
  notes: string | null;
  lessons: string | null;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  pair: { symbol: string; displayName: string };
}

export interface JournalInput {
  pairSymbol: string;
  direction: "BUY" | "SELL";
  /** Links the entry to a trade plan ("Journal This Trade"); server rejects duplicates. */
  tradePlanId?: string;
  plannedEntry?: number | null;
  actualEntry?: number | null;
  plannedExit?: number | null;
  actualExit?: number | null;
  plannedStop?: number | null;
  actualStop?: number | null;
  plannedTarget?: number | null;
  actualTarget?: number | null;
  plannedUnits?: number | null;
  actualUnits?: number | null;
  plannedRisk?: number | null;
  actualRisk?: number | null;
  profitLossAmount?: number | null;
  profitLossPips?: number | null;
  session?: string;
  strategyTag?: string;
  rulesFollowed?: boolean | null;
  emotionalState?: string;
  notes?: string;
  lessons?: string;
  openedAt?: string | null;
  closedAt?: string | null;
}

export interface SegmentStats {
  key: string;
  trades: number;
  wins: number;
  winRatePct: number | null;
  totalPl: number;
  avgR: number | null;
}

export interface JournalAnalytics {
  totalTrades: number;
  meetsSample: boolean;
  minimumSample: number;
  winRatePct: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  avgR: number | null;
  avgRiskPerTrade: number | null;
  totalPl: number;
  planAdherencePct: number | null;
  bestPair: string | null;
  worstPair: string | null;
  bestSession: string | null;
  worstSession: string | null;
  byPair: SegmentStats[];
  bySession: SegmentStats[];
  byStrategy: SegmentStats[];
  byWeekday: SegmentStats[];
  byEvent: SegmentStats[];
  insights: string[];
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function fail(e: unknown, fallback: string): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : fallback;
  if (/authentication required|unauthorized|\b401\b/i.test(msg)) redirect("/sign-in");
  return { ok: false, error: msg };
}

export async function createEntryAction(input: JournalInput): Promise<Result<JournalRow>> {
  try {
    return { ok: true, data: await apiFetch("/api/v1/journal", { method: "POST", body: JSON.stringify(input) }) };
  } catch (e) {
    return fail(e, "Failed to save the journal entry");
  }
}

export async function updateEntryAction(id: string, patch: Partial<JournalInput>): Promise<Result<JournalRow>> {
  try {
    return {
      ok: true,
      data: await apiFetch(`/api/v1/journal/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    };
  } catch (e) {
    return fail(e, "Failed to update the journal entry");
  }
}

export async function deleteEntryAction(id: string): Promise<Result<{ deleted: boolean }>> {
  try {
    return { ok: true, data: await apiFetch(`/api/v1/journal/${id}`, { method: "DELETE" }) };
  } catch (e) {
    return fail(e, "Failed to delete the journal entry");
  }
}

export async function analyticsAction(): Promise<Result<JournalAnalytics>> {
  try {
    return { ok: true, data: await apiFetch("/api/v1/journal/analytics") };
  } catch (e) {
    return fail(e, "Failed to load analytics");
  }
}
