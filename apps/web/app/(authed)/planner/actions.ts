"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

/** Serialized TradePlan row (Prisma Decimals arrive as strings via JSON). */
export interface TradePlanRow {
  id: string;
  direction: "BUY" | "SELL";
  status: "DRAFT" | "PLANNED" | "ENTERED" | "CLOSED" | "CANCELLED";
  entryPrice: string;
  stopLossPrice: string | null;
  takeProfitPrice: string | null;
  riskPercentage: string;
  riskAmount: string | null;
  accountBalance: string | null;
  leverage: string | null;
  positionUnits: number | null;
  lotSize: string | null;
  pipValue: string | null;
  estimatedMargin: string | null;
  effectiveLeverage: string | null;
  rewardRatio: string | null;
  riskStatus: string | null;
  reasoning: string | null;
  strategyTag: string | null;
  session: string | null;
  emotionalState: string | null;
  eventWarning: string | null;
  notes: string | null;
  createdAt: string;
  pair: { symbol: string; displayName: string };
}

export interface TradePlanInput {
  pairSymbol: string;
  direction: "BUY" | "SELL";
  status?: string;
  entryPrice: number;
  stopLossPrice?: number | null;
  takeProfitPrice?: number | null;
  riskPercentage: number;
  accountBalance: number;
  leverage: number;
  reasoning?: string;
  strategyTag?: string;
  session?: string;
  emotionalState?: string;
  notes?: string;
}

export interface PlanExposure {
  planId: string;
  pairSymbol: string;
  direction: string;
  status: string;
  events: { name: string; currency: string; eventTime: string }[];
}

export interface TradeCheckResult {
  status: { status: "WITHIN_PLAN" | "CAUTION" | "OUTSIDE_PLAN" | "MISSING_INFO"; label: string; reasons: string[] };
  warnings: string[];
  actualRiskAmount: number | null;
  actualRiskPct: number | null;
  recommendedUnits: number | null;
  recommendedLots: number | null;
  units: number | null;
  lots: number | null;
  pipValue: number | null;
  requiredMargin: number | null;
  effectiveLeverageLabel: string | null;
  riskRewardLabel: string | null;
  summary: string | null;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function fail(e: unknown, fallback: string): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : fallback;
  if (/authentication required|unauthorized|\b401\b/i.test(msg)) redirect("/sign-in");
  return { ok: false, error: msg };
}

export async function listPlansAction(): Promise<Result<{ plans: TradePlanRow[]; openRisk: number; exposure: PlanExposure[] }>> {
  try {
    return { ok: true, data: await apiFetch("/api/v1/trade-plans") };
  } catch (e) {
    return fail(e, "Failed to load trade plans");
  }
}

export async function checkPlanAction(input: TradePlanInput): Promise<Result<TradeCheckResult>> {
  try {
    return {
      ok: true,
      data: await apiFetch("/api/v1/trade-plans/check", { method: "POST", body: JSON.stringify(input) }),
    };
  } catch (e) {
    return fail(e, "Trade check failed");
  }
}

export async function createPlanAction(input: TradePlanInput): Promise<Result<TradePlanRow>> {
  try {
    return {
      ok: true,
      data: await apiFetch("/api/v1/trade-plans", { method: "POST", body: JSON.stringify(input) }),
    };
  } catch (e) {
    return fail(e, "Failed to save the trade plan");
  }
}

export async function updatePlanStatusAction(id: string, status: string): Promise<Result<TradePlanRow>> {
  try {
    return {
      ok: true,
      data: await apiFetch(`/api/v1/trade-plans/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    };
  } catch (e) {
    return fail(e, "Failed to update the plan");
  }
}

export async function deletePlanAction(id: string): Promise<Result<{ deleted: boolean }>> {
  try {
    return { ok: true, data: await apiFetch(`/api/v1/trade-plans/${id}`, { method: "DELETE" }) };
  } catch (e) {
    return fail(e, "Failed to delete the plan");
  }
}
