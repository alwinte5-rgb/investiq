import { prisma } from "@investiq/db";
import { errors, splitPair, type JournalEntryCreate, type JournalEntryUpdate } from "@investiq/shared";
import { assertOwnedBy } from "../lib/permissions.js";
import type { CalendarService } from "./calendar.js";

/**
 * Trading journal — CRUD + process-first analytics. Insights are gated by
 * minimum sample sizes (n≥10 overall, n≥5 per segment) so small datasets never
 * generate unsupported conclusions.
 */

export const MIN_SAMPLE_OVERALL = 10;
export const MIN_SAMPLE_SEGMENT = 5;

async function resolvePairId(pairSymbol: string): Promise<string> {
  const pair = await prisma.currencyPair.findUnique({ where: { symbol: pairSymbol } });
  if (!pair || !pair.active) throw errors.notFound(`Unknown currency pair: ${pairSymbol}`);
  return pair.id;
}

/** Derive the R-multiple when result and planned risk are both known. */
function deriveRMultiple(input: { profitLossAmount?: number | null; plannedRisk?: number | null; actualRisk?: number | null }) {
  const risk = input.actualRisk ?? input.plannedRisk;
  if (input.profitLossAmount == null || risk == null || !(risk > 0)) return null;
  return Math.round((input.profitLossAmount / risk) * 100) / 100;
}

/**
 * Auto-tag: did a HIGH-impact event on either pair currency fall while the
 * trade was open? Null when open/close times are unknown. An entry closed the
 * same moment it opened still gets a small window so a same-minute release counts.
 */
async function deriveHighImpactEvent(
  pairSymbol: string,
  openedAt: Date | null | undefined,
  closedAt: Date | null | undefined,
  calendar: CalendarService | undefined,
): Promise<boolean | null> {
  if (!calendar || !openedAt) return null;
  const parts = splitPair(pairSymbol);
  if (!parts) return null;
  const from = openedAt;
  const to = closedAt ?? new Date(); // still open: exposure up to now
  if (to.getTime() < from.getTime()) return null;
  return calendar.highImpactBetween([parts.base, parts.quote], from, to);
}

export async function listJournalEntries(userId: string) {
  return prisma.journalEntry.findMany({
    where: { userId },
    orderBy: [{ closedAt: "desc" }, { createdAt: "desc" }],
    include: { pair: { select: { symbol: true, displayName: true } } },
    take: 200,
  });
}

export async function createJournalEntry(userId: string, input: JournalEntryCreate, calendar?: CalendarService) {
  const { pairSymbol, tradePlanId, ...rest } = input;
  const pairId = await resolvePairId(pairSymbol);
  if (tradePlanId) {
    const plan = await prisma.tradePlan.findUnique({ where: { id: tradePlanId } });
    assertOwnedBy(userId, plan); // linking someone else's plan is forbidden
  }
  return prisma.journalEntry.create({
    data: {
      userId,
      pairId,
      tradePlanId: tradePlanId ?? null,
      ...rest,
      rMultiple: deriveRMultiple(input),
      highImpactEvent: await deriveHighImpactEvent(pairSymbol, input.openedAt, input.closedAt, calendar),
    },
  });
}

export async function updateJournalEntry(userId: string, id: string, patch: JournalEntryUpdate, calendar?: CalendarService) {
  const existing = await prisma.journalEntry.findUnique({ where: { id }, include: { pair: true } });
  assertOwnedBy(userId, existing);
  const { pairSymbol, tradePlanId, ...rest } = patch;
  const data: Record<string, unknown> = { ...rest };
  if (pairSymbol) data.pairId = await resolvePairId(pairSymbol);
  // Re-derive the event tag when the timeline or pair changed.
  if (pairSymbol !== undefined || patch.openedAt !== undefined || patch.closedAt !== undefined) {
    data.highImpactEvent = await deriveHighImpactEvent(
      pairSymbol ?? existing!.pair.symbol,
      patch.openedAt ?? existing!.openedAt,
      patch.closedAt ?? existing!.closedAt,
      calendar,
    );
  }
  if (tradePlanId !== undefined) {
    if (tradePlanId) {
      const plan = await prisma.tradePlan.findUnique({ where: { id: tradePlanId } });
      assertOwnedBy(userId, plan);
    }
    data.tradePlanId = tradePlanId ?? null;
  }
  const mergedForR = {
    profitLossAmount: patch.profitLossAmount ?? (existing!.profitLossAmount ? Number(existing!.profitLossAmount) : null),
    plannedRisk: patch.plannedRisk ?? (existing!.plannedRisk ? Number(existing!.plannedRisk) : null),
    actualRisk: patch.actualRisk ?? (existing!.actualRisk ? Number(existing!.actualRisk) : null),
  };
  data.rMultiple = deriveRMultiple(mergedForR);
  return prisma.journalEntry.update({ where: { id }, data });
}

export async function deleteJournalEntry(userId: string, id: string) {
  const existing = await prisma.journalEntry.findUnique({ where: { id } });
  assertOwnedBy(userId, existing);
  await prisma.journalEntry.delete({ where: { id } });
}

// ── Analytics ────────────────────────────────────────────────────────────────

interface SegmentStats {
  key: string;
  trades: number;
  wins: number;
  winRatePct: number | null;
  totalPl: number;
  avgR: number | null;
}

function segment(entries: ClosedEntry[], keyOf: (e: ClosedEntry) => string | null): SegmentStats[] {
  const groups = new Map<string, ClosedEntry[]>();
  for (const e of entries) {
    const key = keyOf(e);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const wins = list.filter((e) => e.pl > 0).length;
      const rs = list.filter((e) => e.r != null).map((e) => e.r!) ?? [];
      const meetsSample = list.length >= MIN_SAMPLE_SEGMENT;
      return {
        key,
        trades: list.length,
        wins,
        winRatePct: meetsSample ? Math.round((wins / list.length) * 1000) / 10 : null,
        totalPl: Math.round(list.reduce((s, e) => s + e.pl, 0) * 100) / 100,
        avgR: meetsSample && rs.length > 0 ? Math.round((rs.reduce((s, r) => s + r, 0) / rs.length) * 100) / 100 : null,
      };
    })
    .sort((a, b) => b.trades - a.trades);
}

interface ClosedEntry {
  pl: number;
  r: number | null;
  pair: string;
  session: string | null;
  strategy: string | null;
  weekday: string | null;
  rulesFollowed: boolean | null;
  actualRisk: number | null;
  plannedRisk: number | null;
  highImpactEvent: boolean | null;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function journalAnalytics(userId: string) {
  const rows = await prisma.journalEntry.findMany({
    where: { userId, profitLossAmount: { not: null } },
    include: { pair: { select: { symbol: true } } },
  });

  const closed: ClosedEntry[] = rows.map((row) => ({
    pl: Number(row.profitLossAmount),
    r: row.rMultiple != null ? Number(row.rMultiple) : null,
    pair: row.pair.symbol,
    session: row.session,
    strategy: row.strategyTag,
    weekday: row.closedAt ? WEEKDAYS[row.closedAt.getUTCDay()] ?? null : null,
    rulesFollowed: row.rulesFollowed,
    actualRisk: row.actualRisk != null ? Number(row.actualRisk) : null,
    plannedRisk: row.plannedRisk != null ? Number(row.plannedRisk) : null,
    highImpactEvent: row.highImpactEvent,
  }));

  const total = closed.length;
  const meetsSample = total >= MIN_SAMPLE_OVERALL;
  const wins = closed.filter((e) => e.pl > 0);
  const losses = closed.filter((e) => e.pl < 0);
  const rs = closed.filter((e) => e.r != null).map((e) => e.r!);
  const ruleTracked = closed.filter((e) => e.rulesFollowed != null);
  const risks = closed.filter((e) => (e.actualRisk ?? e.plannedRisk) != null).map((e) => (e.actualRisk ?? e.plannedRisk)!);

  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null);

  const byPair = segment(closed, (e) => e.pair);
  const bySession = segment(closed, (e) => e.session);
  const byStrategy = segment(closed, (e) => e.strategy);
  const byWeekday = segment(closed, (e) => e.weekday);
  const byEvent = segment(closed, (e) =>
    e.highImpactEvent == null ? null : e.highImpactEvent ? "Held through high-impact event" : "No high-impact event",
  );

  const withSample = byPair.filter((s) => s.trades >= MIN_SAMPLE_SEGMENT);
  const sessionsWithSample = bySession.filter((s) => s.trades >= MIN_SAMPLE_SEGMENT);

  // Process-first insights, only when the sample supports them.
  const insights: string[] = [];
  if (meetsSample) {
    const during = closed.filter((e) => e.highImpactEvent === true);
    const outside = closed.filter((e) => e.highImpactEvent === false);
    if (during.length >= MIN_SAMPLE_SEGMENT && outside.length >= MIN_SAMPLE_SEGMENT) {
      const dAvg = avg(during.map((e) => e.pl));
      const oAvg = avg(outside.map((e) => e.pl));
      if (dAvg != null && oAvg != null && dAvg < oAvg) {
        insights.push(
          `Trades held through a high-impact economic event averaged ${dAvg} versus ${oAvg} when no event occurred — event awareness may be worth building into your plan.`,
        );
      }
    }
  }
  if (meetsSample && ruleTracked.length >= MIN_SAMPLE_SEGMENT) {
    const followed = ruleTracked.filter((e) => e.rulesFollowed === true);
    const broke = ruleTracked.filter((e) => e.rulesFollowed === false);
    if (followed.length >= MIN_SAMPLE_SEGMENT && broke.length >= MIN_SAMPLE_SEGMENT) {
      const fAvg = avg(followed.map((e) => e.pl));
      const bAvg = avg(broke.map((e) => e.pl));
      if (fAvg != null && bAvg != null && fAvg > bAvg) {
        insights.push(
          `Trades where you followed your rules averaged ${fAvg >= 0 ? "+" : ""}${fAvg} versus ${bAvg >= 0 ? "+" : ""}${bAvg} when you didn't.`,
        );
      }
    }
  }

  return {
    totalTrades: total,
    meetsSample,
    minimumSample: MIN_SAMPLE_OVERALL,
    winRatePct: meetsSample ? Math.round((wins.length / total) * 1000) / 10 : null,
    avgWin: meetsSample ? avg(wins.map((e) => e.pl)) : null,
    avgLoss: meetsSample ? avg(losses.map((e) => e.pl)) : null,
    avgR: meetsSample ? avg(rs) : null,
    avgRiskPerTrade: meetsSample ? avg(risks) : null,
    totalPl: Math.round(closed.reduce((s, e) => s + e.pl, 0) * 100) / 100,
    planAdherencePct:
      meetsSample && ruleTracked.length > 0
        ? Math.round((ruleTracked.filter((e) => e.rulesFollowed === true).length / ruleTracked.length) * 1000) / 10
        : null,
    bestPair: meetsSample && withSample.length ? withSample.reduce((a, b) => (b.totalPl > a.totalPl ? b : a)).key : null,
    worstPair: meetsSample && withSample.length ? withSample.reduce((a, b) => (b.totalPl < a.totalPl ? b : a)).key : null,
    bestSession:
      meetsSample && sessionsWithSample.length
        ? sessionsWithSample.reduce((a, b) => (b.totalPl > a.totalPl ? b : a)).key
        : null,
    worstSession:
      meetsSample && sessionsWithSample.length
        ? sessionsWithSample.reduce((a, b) => (b.totalPl < a.totalPl ? b : a)).key
        : null,
    byPair,
    bySession,
    byStrategy,
    byWeekday,
    byEvent,
    insights,
  };
}
