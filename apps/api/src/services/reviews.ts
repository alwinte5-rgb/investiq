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
  type UpdateNotificationPreferences,
} from "@investiq/shared";
import { requireEntitlement } from "../lib/auth.js";
import { loadPortfolioInput } from "./portfolio.js";

const FEATURE_LABEL = "Daily reviews";

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

  const earnings = await loadHeldEarnings(userId, now);
  const content = buildPortfolioReview({
    period,
    asOf: now,
    scores: scored,
    holdings: input.holdings.map((h) => ({ ticker: h.ticker, marketValue: h.marketValue })),
    earnings,
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
