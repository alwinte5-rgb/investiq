import { prisma } from "@investiq/db";
import { DEMO_CASH, DEMO_HOLDINGS, DEMO_TOTAL_VALUE, errors } from "@investiq/shared";

/**
 * Demo ("sample data") portfolio seeding.
 *
 * Stores the fixed sample portfolio (see @investiq/shared `demo.ts`) in the SAME
 * tables as a real brokerage connection — a BrokerageConnection with
 * status "demo" → Account → Holdings — so every downstream read (dashboard
 * summary, Portfolio Intelligence, Reviews, Research, News) works with zero
 * special-casing. Sync/disconnect are guarded against demo connections in
 * `brokerage.ts` because there is no real SnapTrade user behind them.
 *
 * Seeding is scoped to the owning user and idempotent: one demo connection per
 * user, and it refuses to seed alongside a real connection so sample data never
 * pollutes real holdings.
 */

/** BrokerageConnection.status value marking a seeded sample-data connection. */
export const DEMO_STATUS = "demo";
const DEMO_BROKERAGE_NAME = "Demo (sample data)";
const DEMO_ACCOUNT_EXTERNAL_ID = "demo-account";

export interface EnableDemoResult {
  status: "created" | "exists";
  connectionId: string;
  positions: number;
  totalValue: number;
}

export async function enableDemoPortfolio(userId: string): Promise<EnableDemoResult> {
  // Idempotent: a user has at most one demo connection.
  const existingDemo = await prisma.brokerageConnection.findFirst({
    where: { userId, status: DEMO_STATUS },
    select: { id: true },
  });
  if (existingDemo) {
    return {
      status: "exists",
      connectionId: existingDemo.id,
      positions: DEMO_HOLDINGS.length,
      totalValue: DEMO_TOTAL_VALUE,
    };
  }

  // Never mix sample data into a real, working portfolio — it would skew real
  // scores. But a LOCKED/expired (disabled) connection shouldn't block someone
  // from exploring: clear it (cascade drops its empty account shell) and seed
  // the demo. An active connection still has to be disconnected first.
  const realConn = await prisma.brokerageConnection.findFirst({
    where: { userId, status: { not: DEMO_STATUS } },
    select: { id: true, status: true },
  });
  if (realConn) {
    if (realConn.status === "disabled") {
      await prisma.brokerageConnection.delete({ where: { id: realConn.id } });
    } else {
      throw errors.validation(
        "You already have an active brokerage connected. Disconnect it first to load sample data.",
      );
    }
  }

  // Resolve the global Symbol rows. Only fill in an accurate sector on update
  // (scoring buckets by sector) — never overwrite other fields of a real symbol.
  const symbolIds = new Map<string, string>();
  for (const h of DEMO_HOLDINGS) {
    const sym = await prisma.symbol.upsert({
      where: { ticker: h.ticker },
      update: { sector: h.sector ?? undefined },
      create: { ticker: h.ticker, name: h.name, assetType: h.assetType, sector: h.sector },
      select: { id: true },
    });
    symbolIds.set(h.ticker, sym.id);
  }

  const connection = await prisma.brokerageConnection.create({
    data: {
      userId,
      // No real SnapTrade user — these placeholders are never used because
      // sync/disconnect are guarded against demo connections.
      snaptradeUserId: `demo:${userId}`,
      snaptradeSecret: "",
      brokerageName: DEMO_BROKERAGE_NAME,
      status: DEMO_STATUS,
      lastSyncedAt: new Date(),
      accounts: {
        create: {
          externalId: DEMO_ACCOUNT_EXTERNAL_ID,
          name: "Sample brokerage",
          currency: "USD",
          cash: DEMO_CASH,
          totalValue: DEMO_TOTAL_VALUE,
          holdings: {
            create: DEMO_HOLDINGS.map((h) => ({
              symbolId: symbolIds.get(h.ticker)!,
              quantity: h.quantity,
              avgCost: h.avgCost,
              marketValue: h.marketValue,
              unrealizedPl: h.marketValue - h.quantity * h.avgCost,
            })),
          },
        },
      },
    },
    select: { id: true },
  });

  return {
    status: "created",
    connectionId: connection.id,
    positions: DEMO_HOLDINGS.length,
    totalValue: DEMO_TOTAL_VALUE,
  };
}
