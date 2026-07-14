import { prisma } from "@investiq/db";
import {
  entitlementsFor,
  errors,
  type Plan,
  type TradeCalcRequest,
  type TradeCalcResult,
  type TradePlanCreate,
  type TradePlanUpdate,
} from "@investiq/shared";
import { assertOwnedBy } from "../lib/permissions.js";
import { calculateTrade, type TradeCalcDeps } from "./trade-calc.js";

/**
 * Trade plans — the planning workflow. Every save re-runs the shared calc
 * engine server-side (never trusting client-computed risk numbers) and stores
 * the results + the risk status at save time. Object-level authz on every
 * read/mutation.
 */

const ACTIVE_STATUSES = ["DRAFT", "PLANNED", "ENTERED"] as const;

function toCalcRequest(input: TradePlanCreate | (TradePlanUpdate & TradePlanCreate)) {
  return {
    accountBalance: input.accountBalance,
    pairSymbol: input.pairSymbol,
    direction: input.direction,
    entryPrice: input.entryPrice,
    stopLossPrice: input.stopLossPrice ?? null,
    takeProfitPrice: input.takeProfitPrice ?? null,
    riskPercentage: input.riskPercentage,
    leverage: input.leverage,
    positionUnitsOverride: input.positionUnitsOverride ?? null,
    lotSizeOverride: input.lotSizeOverride ?? null,
  };
}

/** Run the pre-save trade check for a plan payload. */
export async function checkTradePlan(userId: string, input: TradePlanCreate, deps: TradeCalcDeps) {
  const settings = await prisma.userForexSettings.findUnique({ where: { userId } });
  // Stored via the validated settings schema, so the cast is sound.
  const accountCurrency = (settings?.accountCurrency ?? "USD") as TradeCalcRequest["accountCurrency"];
  return calculateTrade(userId, { ...toCalcRequest(input), accountCurrency }, deps);
}

function planData(input: TradePlanCreate, pairId: string, calc: TradeCalcResult) {
  return {
    pairId,
    direction: input.direction,
    status: input.status,
    entryPrice: input.entryPrice,
    stopLossPrice: input.stopLossPrice ?? null,
    takeProfitPrice: input.takeProfitPrice ?? null,
    riskPercentage: input.riskPercentage,
    riskAmount: calc.actualRiskAmount,
    accountBalance: input.accountBalance,
    leverage: input.leverage,
    positionUnits: calc.units,
    lotSize: calc.lots,
    pipValue: calc.pipValue,
    estimatedMargin: calc.requiredMargin,
    effectiveLeverage: calc.effectiveLeverage,
    rewardRatio: calc.riskReward,
    riskStatus: calc.status.status,
    reasoning: input.reasoning ?? null,
    strategyTag: input.strategyTag ?? null,
    session: input.session ?? null,
    emotionalState: input.emotionalState ?? null,
    eventWarning: calc.warnings.find((w) => w.startsWith("High-impact event")) ?? null,
    notes: input.notes ?? null,
  };
}

export async function listTradePlans(userId: string) {
  const plans = await prisma.tradePlan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { pair: { select: { symbol: true, displayName: true } } },
    take: 100,
  });
  return plans;
}

/** Sum of riskAmount across open (draft/planned/entered) plans — dashboard risk allowance. */
export async function openPlannedRisk(userId: string) {
  const open = await prisma.tradePlan.findMany({
    where: { userId, status: { in: [...ACTIVE_STATUSES] } },
    select: { riskAmount: true },
  });
  return open.reduce((sum, p) => sum + (p.riskAmount ? Number(p.riskAmount) : 0), 0);
}

export async function createTradePlan(userId: string, plan: Plan, input: TradePlanCreate, deps: TradeCalcDeps) {
  const pair = await prisma.currencyPair.findUnique({ where: { symbol: input.pairSymbol } });
  if (!pair || !pair.active) throw errors.notFound(`Unknown currency pair: ${input.pairSymbol}`);

  const calc = await checkTradePlan(userId, input, deps);

  const limit = entitlementsFor(plan).savedTradePlanLimit;
  if (limit !== null) {
    // Serializable so two concurrent creates can't both pass the count check.
    return prisma.$transaction(
      async (tx) => {
        const count = await tx.tradePlan.count({ where: { userId, status: { in: [...ACTIVE_STATUSES] } } });
        if (count >= limit) {
          throw errors.quota(`Free plan allows ${limit} active trade plans. Close or cancel one, or upgrade.`);
        }
        return tx.tradePlan.create({ data: { userId, ...planData(input, pair.id, calc) } });
      },
      { isolationLevel: "Serializable" },
    );
  }
  return prisma.tradePlan.create({ data: { userId, ...planData(input, pair.id, calc) } });
}

export async function updateTradePlan(userId: string, id: string, patch: TradePlanUpdate, deps: TradeCalcDeps) {
  const existing = await prisma.tradePlan.findUnique({ where: { id }, include: { pair: true } });
  assertOwnedBy(userId, existing);
  const plan = existing!;

  // Status-only change (e.g. PLANNED → ENTERED → CLOSED): no recalc needed.
  const { status, ...rest } = patch;
  if (Object.keys(rest).length === 0 && status) {
    return prisma.tradePlan.update({ where: { id }, data: { status } });
  }

  // Anything numeric changed: merge with the stored plan and re-run the engine.
  const merged: TradePlanCreate = {
    pairSymbol: rest.pairSymbol ?? plan.pair.symbol,
    direction: rest.direction ?? plan.direction,
    status: status ?? plan.status,
    entryPrice: rest.entryPrice ?? Number(plan.entryPrice),
    stopLossPrice: rest.stopLossPrice ?? (plan.stopLossPrice ? Number(plan.stopLossPrice) : null),
    takeProfitPrice: rest.takeProfitPrice ?? (plan.takeProfitPrice ? Number(plan.takeProfitPrice) : null),
    riskPercentage: rest.riskPercentage ?? Number(plan.riskPercentage),
    accountBalance: rest.accountBalance ?? Number(plan.accountBalance ?? 0),
    leverage: rest.leverage ?? Number(plan.leverage ?? 0),
    positionUnitsOverride: rest.positionUnitsOverride ?? null,
    lotSizeOverride: rest.lotSizeOverride ?? null,
    reasoning: rest.reasoning ?? plan.reasoning ?? undefined,
    strategyTag: rest.strategyTag ?? plan.strategyTag ?? undefined,
    session: rest.session ?? plan.session ?? undefined,
    emotionalState: rest.emotionalState ?? plan.emotionalState ?? undefined,
    notes: rest.notes ?? plan.notes ?? undefined,
  };
  const pair =
    merged.pairSymbol === plan.pair.symbol
      ? plan.pair
      : await prisma.currencyPair.findUnique({ where: { symbol: merged.pairSymbol } });
  if (!pair || !pair.active) throw errors.notFound(`Unknown currency pair: ${merged.pairSymbol}`);
  const calc = await checkTradePlan(userId, merged, deps);
  return prisma.tradePlan.update({ where: { id }, data: planData(merged, pair.id, calc) });
}

export async function deleteTradePlan(userId: string, id: string) {
  const existing = await prisma.tradePlan.findUnique({ where: { id } });
  assertOwnedBy(userId, existing);
  await prisma.tradePlan.delete({ where: { id } });
}
