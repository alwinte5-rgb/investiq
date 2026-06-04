import { prisma, Prisma } from "@investiq/db";
import {
  assessRisk,
  volatilityFromBeta,
  errors,
  type RiskResult,
  type WarningColor,
} from "@investiq/shared";
import type { MarketService } from "./market.js";
import type { FundamentalsService } from "./fundamentals.js";
import { findSymbolByTicker } from "./symbols.js";
import { loadPortfolioInput } from "./portfolio.js";

/**
 * Layer 6 — Risk Engine. Assembles real inputs (live price, beta-derived
 * volatility, next earnings, latest grounded news sentiment, and the user's own
 * position weight + account value) and runs the deterministic `assessRisk` core,
 * then persists the result. Scoped to the requesting user. Educational framing.
 */
export interface RiskDeps {
  market: MarketService;
  fundamentals: FundamentalsService;
}

export type SymbolRiskResult = RiskResult & { ticker: string };

export async function assessSymbolRisk(
  userId: string,
  ticker: string,
  deps: RiskDeps,
): Promise<SymbolRiskResult> {
  const symbol = await findSymbolByTicker(ticker);
  if (!symbol) throw errors.notFound(`Unknown or unsupported symbol: ${ticker}`);
  const T = ticker.toUpperCase();

  // --- current price (required for any levels) ---
  let price = 0;
  try {
    const q = await deps.market.getQuote(T);
    price = Number(q.price) || 0;
  } catch {
    /* no price → assessRisk returns insufficient */
  }

  // --- volatility from beta (best-effort) ---
  let volatilityPct = volatilityFromBeta(null);
  try {
    const f = await deps.fundamentals.getFundamentals(T);
    volatilityPct = volatilityFromBeta(f?.beta ?? null);
  } catch {
    /* keep default volatility */
  }

  // --- next earnings (event risk) ---
  const now = new Date();
  const nextEarnings = await prisma.earningsEvent.findFirst({
    where: { symbolId: symbol.id, date: { gte: now } },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  const earningsInDays = nextEarnings
    ? Math.round((nextEarnings.date.getTime() - now.getTime()) / 86400000)
    : null;

  // --- latest grounded news sentiment (Layer 5) ---
  const latestImpact = await prisma.newsImpact.findFirst({
    where: { symbolId: symbol.id },
    orderBy: { generatedAt: "desc" },
    select: { impact: true },
  });

  // --- the user's own position weight + account value ---
  const { holdings, cash } = await loadPortfolioInput(userId);
  const invested = holdings.reduce((acc, h) => acc + h.marketValue, 0);
  const accountValue = invested + cash;
  const held = holdings.find((h) => h.ticker === T);
  const heldWeightPct =
    held && accountValue > 0 ? (held.marketValue / accountValue) * 100 : null;

  const result = assessRisk({
    price,
    volatilityPct,
    earningsInDays,
    newsSentiment: latestImpact?.impact ?? null,
    heldWeightPct,
    accountValue: accountValue > 0 ? accountValue : null,
  });

  if (result.status === "assessed") {
    await prisma.riskAssessment.create({
      data: {
        userId,
        symbolId: symbol.id,
        buyZoneLow: result.buyZoneLow,
        buyZoneHigh: result.buyZoneHigh,
        stopLoss: result.stopLoss,
        profitTarget: result.profitTarget,
        riskReward: result.riskReward,
        positionSize: result.positionSize ?? undefined,
        maxRiskPct: result.maxRiskPct,
        warningColor: result.warningColor as WarningColor,
        warningReasons: result.warnings as unknown as Prisma.InputJsonValue,
      },
    });
  }

  return { ...result, ticker: T };
}

/** Latest stored risk assessment for a user + symbol (no recompute). */
export async function getLatestSymbolRisk(userId: string, ticker: string) {
  const symbol = await findSymbolByTicker(ticker);
  if (!symbol) throw errors.notFound(`Unknown or unsupported symbol: ${ticker}`);
  return prisma.riskAssessment.findFirst({
    where: { userId, symbolId: symbol.id },
    orderBy: { generatedAt: "desc" },
  });
}
