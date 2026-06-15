import { prisma, Prisma } from "@investiq/db";
import {
  scorePortfolio,
  buildPortfolioReview,
  periodKeyFor,
  EARNINGS_WINDOW_DAYS,
  type Plan,
  type ReviewPeriod,
  type ReviewEarnings,
  type ReviewContent,
  type ReviewNewsItem,
  type UpdateNotificationPreferences,
} from "@investiq/shared";
import { requireEntitlement } from "../lib/auth.js";
import { loadPortfolioInput } from "./portfolio.js";
import type { MarketService } from "./market.js";

const FEATURE_LABEL = "Daily reviews";
const NEWS_LOOKBACK_DAYS = 7;

/** Optional dependencies for richer briefings (live moves). */
export interface ReviewDeps {
  market?: MarketService;
}

/** Health score from the prior review of the same period (for a week/month delta). */
async function loadPriorHealthScore(
  userId: string,
  period: ReviewPeriod,
  periodKey: string,
): Promise<number | null> {
  const prior = await prisma.portfolioReview.findFirst({
    where: { userId, period, periodKey: { not: periodKey } },
    orderBy: { generatedAt: "desc" },
    select: { content: true },
  });
  const health = (prior?.content as { healthScore?: unknown } | null)?.healthScore;
  return typeof health === "number" ? health : null;
}

/** Recent grounded news for the user's held tickers (newest first, deduped per ticker). */
async function loadHeldNews(userId: string, now: Date): Promise<ReviewNewsItem[]> {
  const since = new Date(now.getTime() - NEWS_LOOKBACK_DAYS * 86400000);
  const holdings = await prisma.holding.findMany({
    where: { account: { connection: { userId } }, marketValue: { gt: 0 } },
    select: { symbolId: true, symbol: { select: { ticker: true } } },
  });
  if (holdings.length === 0) return [];
  const tickerById = new Map(holdings.map((h) => [h.symbolId, h.symbol.ticker]));

  const rows = await prisma.newsImpact.findMany({
    where: {
      symbolId: { in: [...tickerById.keys()] },
      article: { publishedAt: { gte: since } },
    },
    orderBy: { article: { publishedAt: "desc" } },
    take: 20,
    select: { impact: true, symbolId: true, article: { select: { headline: true } } },
  });
  const seen = new Set<string>();
  const out: ReviewNewsItem[] = [];
  for (const r of rows) {
    const ticker = tickerById.get(r.symbolId);
    if (!ticker || seen.has(ticker)) continue; // one highlight per ticker
    seen.add(ticker);
    out.push({
      ticker,
      headline: r.article.headline,
      impact: r.impact as ReviewNewsItem["impact"],
    });
  }
  return out;
}

/** Today's % change per held ticker (best-effort live quotes; empty without a market dep). */
async function loadHoldingChanges(
  market: MarketService | undefined,
  tickers: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!market || tickers.length === 0) return map;
  const settled = await Promise.allSettled(tickers.map((t) => market.getQuote(t)));
  settled.forEach((r) => {
    if (r.status === "fulfilled" && r.value.changePct != null) {
      map.set(r.value.ticker.toUpperCase(), r.value.changePct);
    }
  });
  return map;
}

/** Read the user's notification preferences, creating defaults on first access
 * so callers always get a complete row (timezone, channel + period toggles). */
export function getPreferences(userId: string) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

/** Apply a validated partial update to the user's notification preferences. */
export function updatePreferences(userId: string, patch: UpdateNotificationPreferences) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...patch },
    update: patch,
  });
}

/** Earnings dates for the user's held tickers, from now through the flag window. */
async function loadHeldEarnings(userId: string, now: Date): Promise<ReviewEarnings[]> {
  const windowEnd = new Date(now.getTime() + (EARNINGS_WINDOW_DAYS + 1) * 86400000);
  const rows = await prisma.earningsEvent.findMany({
    where: {
      date: { gte: now, lte: windowEnd },
      symbol: { holdings: { some: { account: { connection: { userId } } } } },
    },
    select: { date: true, symbol: { select: { ticker: true } } },
  });
  return rows.map((r) => ({ ticker: r.symbol.ticker, date: r.date }));
}

export type GenerateReviewResult =
  | { status: "exists"; review: NonNullable<Awaited<ReturnType<typeof findReview>>> }
  | { status: "insufficient"; message: string; holdingsCount: number }
  | {
      status: "created";
      review: NonNullable<Awaited<ReturnType<typeof findReview>>>;
      content: ReviewContent;
    };

function findReview(userId: string, period: ReviewPeriod, periodKey: string) {
  return prisma.portfolioReview.findUnique({
    where: { userId_period_periodKey: { userId, period, periodKey } },
  });
}

/**
 * Generate (or return the existing) review for a user + period. Investor+ gated.
 * Idempotent per period via the (userId, period, periodKey) unique constraint —
 * a second run in the same period returns the stored review, never a duplicate.
 * A thin portfolio yields an honest "insufficient", never fabricated scores.
 */
export async function generateReview(
  userId: string,
  plan: Plan,
  period: ReviewPeriod,
  now: Date = new Date(),
  deps: ReviewDeps = {},
): Promise<GenerateReviewResult> {
  requireEntitlement(plan, "dailyReviews", FEATURE_LABEL);

  const prefs = await getPreferences(userId);
  const periodKey = periodKeyFor(period, now, prefs.timezone);

  const existing = await findReview(userId, period, periodKey);
  if (existing) return { status: "exists", review: existing };

  const input = await loadPortfolioInput(userId);
  const scored = scorePortfolio(input);
  if (scored.status === "insufficient") {
    return { status: "insufficient", message: scored.message, holdingsCount: scored.holdingsCount };
  }

  // Enrich the briefing with held-ticker context (all best-effort).
  const tickers = input.holdings.map((h) => h.ticker);
  const [earnings, priorHealthScore, news, changes] = await Promise.all([
    loadHeldEarnings(userId, now),
    loadPriorHealthScore(userId, period, periodKey),
    loadHeldNews(userId, now),
    loadHoldingChanges(deps.market, tickers),
  ]);
  const content = buildPortfolioReview({
    period,
    asOf: now,
    scores: scored,
    holdings: input.holdings.map((h) => ({
      ticker: h.ticker,
      marketValue: h.marketValue,
      changePct: changes.get(h.ticker.toUpperCase()) ?? null,
    })),
    earnings,
    priorHealthScore,
    news,
  });

  try {
    const review = await prisma.portfolioReview.create({
      data: { userId, period, periodKey, content: content as unknown as Prisma.InputJsonValue },
    });
    return { status: "created", review, content };
  } catch (e) {
    // Lost a race with a concurrent run for the same period — return the winner.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const review = await findReview(userId, period, periodKey);
      if (review) return { status: "exists", review };
    }
    throw e;
  }
}

/** Latest stored review (optionally filtered by period). Investor+ gated. */
export function getLatestReview(userId: string, plan: Plan, period?: ReviewPeriod) {
  requireEntitlement(plan, "dailyReviews", FEATURE_LABEL);
  return prisma.portfolioReview.findFirst({
    where: { userId, ...(period ? { period } : {}) },
    orderBy: { generatedAt: "desc" },
  });
}
