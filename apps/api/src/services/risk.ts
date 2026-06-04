import { prisma, Prisma } from "@investiq/db";
import {
  assessRisk,
  riskWarnings,
  volatilityFromBeta,
  errors,
  type RiskResult,
  type RiskWarning,
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

export interface HoldingRisk {
  ticker: string;
  name: string;
  weightPct: number;
  warningColor: WarningColor;
  warnings: RiskWarning[];
}
export type PortfolioRiskResult =
  | { status: "assessed"; overallColor: WarningColor; assessedAt: string; holdings: HoldingRisk[] }
  | { status: "insufficient"; message: string };

const COLOR_RANK: Record<WarningColor, number> = { GREEN: 0, YELLOW: 1, ORANGE: 2, RED: 3 };

/**
 * Portfolio-level risk: a per-holding warning roll-up (concentration, upcoming
 * earnings, latest grounded news sentiment) computed from STORED data only — no
 * live market calls — plus the portfolio's overall color (its riskiest holding).
 */
export async function assessPortfolioRisk(userId: string): Promise<PortfolioRiskResult> {
  const accounts = await prisma.account.findMany({
    where: { connection: { userId } },
    select: {
      cash: true,
      holdings: {
        select: { marketValue: true, symbol: { select: { id: true, ticker: true, name: true } } },
      },
    },
  });

  let cash = 0;
  const bySymbol = new Map<string, { ticker: string; name: string; value: number }>();
  for (const a of accounts) {
    cash += Number(a.cash ?? 0);
    for (const h of a.holdings) {
      const mv = Number(h.marketValue ?? 0);
      if (mv <= 0) continue;
      const prev = bySymbol.get(h.symbol.id);
      if (prev) prev.value += mv;
      else bySymbol.set(h.symbol.id, { ticker: h.symbol.ticker, name: h.symbol.name, value: mv });
    }
  }
  if (bySymbol.size === 0) {
    return { status: "insufficient", message: "No holdings to assess yet." };
  }

  const invested = [...bySymbol.values()].reduce((acc, s) => acc + s.value, 0);
  const accountValue = invested + cash;
  const ids = [...bySymbol.keys()];
  const now = new Date();

  const earnings = await prisma.earningsEvent.findMany({
    where: { symbolId: { in: ids }, date: { gte: now } },
    orderBy: { date: "asc" },
    select: { symbolId: true, date: true },
  });
  const earliestEarnings = new Map<string, Date>();
  for (const e of earnings) if (!earliestEarnings.has(e.symbolId)) earliestEarnings.set(e.symbolId, e.date);

  const impacts = await prisma.newsImpact.findMany({
    where: { symbolId: { in: ids } },
    orderBy: { generatedAt: "desc" },
    select: { symbolId: true, impact: true },
  });
  const latestImpact = new Map<string, string>();
  for (const i of impacts) if (!latestImpact.has(i.symbolId)) latestImpact.set(i.symbolId, i.impact);

  const holdings: HoldingRisk[] = [];
  for (const [id, s] of bySymbol) {
    const weightPct = accountValue > 0 ? (s.value / accountValue) * 100 : 0;
    const e = earliestEarnings.get(id);
    const earningsInDays = e ? Math.round((e.getTime() - now.getTime()) / 86400000) : null;
    const { warnings, warningColor } = riskWarnings({
      heldWeightPct: weightPct,
      earningsInDays,
      newsSentiment: (latestImpact.get(id) as "POSITIVE" | "NEUTRAL" | "NEGATIVE" | undefined) ?? null,
    });
    holdings.push({
      ticker: s.ticker,
      name: s.name,
      weightPct: Math.round(weightPct * 10) / 10,
      warningColor,
      warnings,
    });
  }
  holdings.sort(
    (a, b) => COLOR_RANK[b.warningColor] - COLOR_RANK[a.warningColor] || b.weightPct - a.weightPct,
  );
  const overallColor = holdings.reduce<WarningColor>(
    (acc, h) => (COLOR_RANK[h.warningColor] > COLOR_RANK[acc] ? h.warningColor : acc),
    "GREEN",
  );

  return { status: "assessed", overallColor, assessedAt: now.toISOString(), holdings };
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
