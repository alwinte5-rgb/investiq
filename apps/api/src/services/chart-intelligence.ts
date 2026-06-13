import { prisma } from "@investiq/db";
import {
  buildChartOverlay,
  errors,
  type ChartEvent,
  type ChartOverlay,
  type ChartRiskInput,
  type NewsTone,
  type ShowMeWhyItem,
  type WarningColor,
} from "@investiq/shared";
import { findSymbolByTicker } from "./symbols.js";
import type { MarketService } from "./market.js";

/**
 * Layer 7 — Chart Intelligence. Projects the user's already-stored risk
 * assessment, AI analysis (+ its evidence, the "Show Me Why"), and the symbol's
 * real earnings/classified-news events into one overlay payload that web and
 * mobile render identically.
 *
 * Personalized + read-only over stored data: the levels are a faithful
 * projection of what the risk engine computed (the chart can never claim a level
 * it didn't). The ONLY live value is the current price (best-effort), used to
 * anchor the level ladder so users see where price sits relative to the zones.
 */

/** Earnings markers within ±90 days of now. */
const EARNINGS_WINDOW_DAYS = 90;
/** Classified-news markers from the last 60 days. */
const NEWS_WINDOW_DAYS = 60;
const MAX_NEWS_EVENTS = 12;
const DAY_MS = 86_400_000;

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Pull the model's note out of an evidence snapshot ({ note, value }). */
function noteOf(snapshot: unknown): string | null {
  if (snapshot && typeof snapshot === "object" && "note" in snapshot) {
    const note = (snapshot as { note?: unknown }).note;
    return typeof note === "string" && note.trim() ? note : null;
  }
  return null;
}

export async function getChartOverlay(
  userId: string,
  ticker: string,
  market?: MarketService,
): Promise<ChartOverlay> {
  const T = ticker.toUpperCase();
  const symbol = await findSymbolByTicker(T);
  if (!symbol) throw errors.notFound(`Unknown or unsupported symbol: ${ticker}`);
  const now = new Date();

  // Live current price — best-effort; the ladder still renders without it.
  let currentPrice: number | null = null;
  if (market) {
    try {
      currentPrice = (await market.getQuote(T)).price;
    } catch {
      /* no live price — ladder falls back to level-only scaling */
    }
  }

  const [riskRow, analysisRow, earnings, impacts] = await Promise.all([
    prisma.riskAssessment.findFirst({
      where: { userId, symbolId: symbol.id },
      orderBy: { generatedAt: "desc" },
    }),
    prisma.analysis.findFirst({
      where: { userId, symbolId: symbol.id },
      orderBy: { generatedAt: "desc" },
      include: { evidence: true },
    }),
    prisma.earningsEvent.findMany({
      where: {
        symbolId: symbol.id,
        date: {
          gte: new Date(now.getTime() - EARNINGS_WINDOW_DAYS * DAY_MS),
          lte: new Date(now.getTime() + EARNINGS_WINDOW_DAYS * DAY_MS),
        },
      },
      orderBy: { date: "asc" },
      select: { date: true, confirmed: true },
    }),
    prisma.newsImpact.findMany({
      where: {
        symbolId: symbol.id,
        article: { publishedAt: { gte: new Date(now.getTime() - NEWS_WINDOW_DAYS * DAY_MS) } },
      },
      orderBy: { article: { publishedAt: "desc" } },
      take: MAX_NEWS_EVENTS,
      select: {
        impact: true,
        rationale: true,
        article: { select: { headline: true, url: true, publishedAt: true } },
      },
    }),
  ]);

  // Risk levels — only build them when every line is present (a partial stored
  // row would draw a misleading chart).
  let risk: ChartRiskInput | null = null;
  if (riskRow) {
    const buyZoneLow = num(riskRow.buyZoneLow);
    const buyZoneHigh = num(riskRow.buyZoneHigh);
    const stopLoss = num(riskRow.stopLoss);
    const profitTarget = num(riskRow.profitTarget);
    const riskReward = num(riskRow.riskReward);
    if (
      buyZoneLow != null &&
      buyZoneHigh != null &&
      stopLoss != null &&
      profitTarget != null &&
      riskReward != null
    ) {
      risk = {
        buyZoneLow,
        buyZoneHigh,
        stopLoss,
        profitTarget,
        riskReward,
        warningColor: riskRow.warningColor as WarningColor,
      };
    }
  }

  const analysis = analysisRow
    ? {
        recommendationType: analysisRow.recommendationType as string,
        confidenceScore: analysisRow.confidenceScore,
        riskScore: analysisRow.riskScore,
        evidence: analysisRow.evidence.map<ShowMeWhyItem>((e) => ({
          sourceType: e.sourceType,
          role: e.role as ShowMeWhyItem["role"],
          note: noteOf(e.snapshot),
        })),
      }
    : null;

  const events: ChartEvent[] = [
    ...earnings.map<ChartEvent>((e) => ({
      kind: "EARNINGS",
      date: e.date.toISOString(),
      label: e.confirmed ? "Earnings" : "Earnings (estimated)",
    })),
    ...impacts.map<ChartEvent>((i) => ({
      kind: "NEWS",
      date: i.article.publishedAt.toISOString(),
      label: i.article.headline,
      tone: i.impact as NewsTone,
      url: i.article.url,
      rationale: i.rationale,
    })),
  ];

  return buildChartOverlay({ ticker: T, risk, analysis, events, currentPrice, now });
}
