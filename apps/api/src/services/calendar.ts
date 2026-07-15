import { prisma } from "@investiq/db";
import type { CalendarQuery } from "@investiq/shared";

/**
 * Economic calendar — provider-agnostic service (Phase-4 ready).
 *
 * The `EconomicEvent` table is the read model; a future provider adapter
 * ingests into it (idempotent on `externalId`). Until one is wired the table
 * is empty and the UI shows an honest empty state — never fabricated events,
 * and never trading recommendations derived from events.
 */

export interface EconomicCalendarProvider {
  readonly name: string;
  readonly enabled: boolean;
  /** Ingest upcoming events into the EconomicEvent table (idempotent). */
  sync(): Promise<{ upserted: number }>;
}

/** No provider configured — the calendar UI shows its empty state. */
export function createNullCalendarProvider(): EconomicCalendarProvider {
  return {
    name: "none",
    enabled: false,
    async sync() {
      return { upserted: 0 };
    },
  };
}

export interface CalendarService {
  readonly providerEnabled: boolean;
  listEvents(userId: string, query: CalendarQuery): Promise<{
    events: Awaited<ReturnType<typeof queryEvents>>;
    providerEnabled: boolean;
  }>;
  /** High-impact events within `withinMinutes` touching either currency of a pair. */
  upcomingHighImpact(currencies: string[], withinMinutes: number): Promise<{ name: string; currency: string; eventTime: Date }[]>;
  /** All upcoming events (any impact) for the currencies within the window — informational context. */
  upcomingEvents(
    currencies: string[],
    withinMinutes: number,
  ): Promise<{ name: string; currency: string; impact: string; eventTime: Date; forecastValue: string | null; previousValue: string | null }[]>;
  /** Did a HIGH-impact event on these currencies fall inside [from, to]? (journal correlation) */
  highImpactBetween(currencies: string[], from: Date, to: Date): Promise<boolean>;
}

async function queryEvents(where: Record<string, unknown>) {
  return prisma.economicEvent.findMany({
    where,
    orderBy: { eventTime: "asc" },
    take: 200,
  });
}

/** Re-sync the provider feed at most this often (weekly feed, hourly refresh of actuals). */
const SYNC_INTERVAL_MS = 60 * 60 * 1000;

export function createCalendarService(provider: EconomicCalendarProvider): CalendarService {
  let lastSyncAt = 0;
  let syncing: Promise<unknown> | null = null;

  /** Sync-on-read with a TTL guard and single-flight — no cron dependency. */
  async function ensureFresh() {
    if (!provider.enabled || Date.now() - lastSyncAt < SYNC_INTERVAL_MS) return;
    syncing ??= provider
      .sync()
      .then(() => {
        lastSyncAt = Date.now();
      })
      .catch(() => {
        // Provider hiccup: keep serving what's in the table; retry sooner.
        lastSyncAt = Date.now() - SYNC_INTERVAL_MS + 5 * 60 * 1000;
      })
      .finally(() => {
        syncing = null;
      });
    await syncing;
  }

  return {
    providerEnabled: provider.enabled,

    async listEvents(userId, query) {
      await ensureFresh();
      const where: Record<string, unknown> = {};
      // Default window: from now through 14 days out (calendar is forward-looking).
      const from = query.from ?? new Date();
      const to = query.to ?? new Date(from.getTime() + 14 * 86_400_000);
      where.eventTime = { gte: from, lte: to };
      if (query.currency) where.currency = query.currency;
      if (query.impact) where.impact = query.impact;
      if (query.savedOnly) {
        const saved = await prisma.savedPair.findMany({
          where: { userId },
          include: { pair: { select: { baseCurrency: true, quoteCurrency: true } } },
        });
        const currencies = [...new Set(saved.flatMap((s) => [s.pair.baseCurrency, s.pair.quoteCurrency]))];
        where.currency = query.currency ? query.currency : { in: currencies };
      }
      return { events: await queryEvents(where), providerEnabled: provider.enabled };
    },

    async upcomingHighImpact(currencies, withinMinutes) {
      if (currencies.length === 0) return [];
      await ensureFresh();
      const now = new Date();
      const events = await prisma.economicEvent.findMany({
        where: {
          impact: "HIGH",
          currency: { in: currencies },
          eventTime: { gte: now, lte: new Date(now.getTime() + withinMinutes * 60_000) },
        },
        orderBy: { eventTime: "asc" },
        select: { name: true, currency: true, eventTime: true },
      });
      return events;
    },

    async upcomingEvents(currencies, withinMinutes) {
      if (currencies.length === 0) return [];
      await ensureFresh();
      const now = new Date();
      return prisma.economicEvent.findMany({
        where: {
          currency: { in: currencies },
          impact: { in: ["HIGH", "MEDIUM"] },
          eventTime: { gte: now, lte: new Date(now.getTime() + withinMinutes * 60_000) },
        },
        orderBy: { eventTime: "asc" },
        take: 8,
        select: {
          name: true,
          currency: true,
          impact: true,
          eventTime: true,
          forecastValue: true,
          previousValue: true,
        },
      });
    },

    async highImpactBetween(currencies, from, to) {
      if (currencies.length === 0) return false;
      const count = await prisma.economicEvent.count({
        where: { impact: "HIGH", currency: { in: currencies }, eventTime: { gte: from, lte: to } },
      });
      return count > 0;
    },
  };
}
