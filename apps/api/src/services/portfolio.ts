import { prisma, Prisma } from "@investiq/db";
import {
  scorePortfolio,
  type HoldingInput,
  type Plan,
  type PortfolioScores,
} from "@investiq/shared";
import { requireEntitlement } from "../lib/auth.js";

const FEATURE_LABEL = "Portfolio Intelligence";

/** Load the user's holdings (with sector/assetType) + total cash from stored data. */
async function loadPortfolioInput(userId: string): Promise<{ holdings: HoldingInput[]; cash: number }> {
  const accounts = await prisma.account.findMany({
    where: { connection: { userId } },
    select: {
      cash: true,
      holdings: {
        select: {
          quantity: true,
          marketValue: true,
          symbol: { select: { ticker: true, assetType: true, sector: true } },
        },
      },
    },
  });

  let cash = 0;
  const holdings: HoldingInput[] = [];
  for (const a of accounts) {
    cash += Number(a.cash ?? 0);
    for (const hld of a.holdings) {
      holdings.push({
        ticker: hld.symbol.ticker,
        assetType: hld.symbol.assetType, // "STOCK" | "ETF"
        sector: hld.symbol.sector,
        marketValue: Number(hld.marketValue ?? 0),
      });
    }
  }
  return { holdings, cash };
}

function persistScores(userId: string, s: PortfolioScores) {
  return prisma.portfolioAnalysis.create({
    data: {
      userId,
      healthScore: s.healthScore,
      riskScore: s.riskScore,
      diversificationScore: s.diversificationScore,
      cashScore: s.cashScore,
      sectorConcentration: s.sectorConcentration as unknown as Prisma.InputJsonValue,
      overweight: s.overweight as unknown as Prisma.InputJsonValue,
      underweight: s.underweight as unknown as Prisma.InputJsonValue,
      strengths: s.strengths,
      weaknesses: s.weaknesses,
      improvements: s.improvements,
    },
  });
}

/**
 * Generate a portfolio analysis for a user. Investor+ gated (server-side).
 * Deterministic scoring over stored holdings — a thin portfolio yields an honest
 * "not enough holdings" instead of fabricated scores.
 */
export async function generatePortfolioAnalysis(userId: string, plan: Plan) {
  requireEntitlement(plan, "portfolioIntelligence", FEATURE_LABEL);

  const input = await loadPortfolioInput(userId);
  const result = scorePortfolio(input);

  if (result.status === "insufficient") {
    return { status: "insufficient" as const, message: result.message, holdingsCount: result.holdingsCount };
  }

  const analysis = await persistScores(userId, result);
  // Return the rich scored result (sector breakdown, narrative) plus the stored id.
  return { status: "scored" as const, analysis: { ...result, id: analysis.id, generatedAt: analysis.generatedAt } };
}

/** Latest stored portfolio analysis, or null. Investor+ gated. */
export async function getLatestPortfolioAnalysis(userId: string, plan: Plan) {
  requireEntitlement(plan, "portfolioIntelligence", FEATURE_LABEL);
  return prisma.portfolioAnalysis.findFirst({
    where: { userId },
    orderBy: { generatedAt: "desc" },
  });
}
