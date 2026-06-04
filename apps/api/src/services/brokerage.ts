import { randomUUID } from "node:crypto";
import { prisma } from "@investiq/db";
import {
  decryptSecret,
  encryptSecret,
  errors,
} from "@investiq/shared";
import type {
  AccountHoldings,
  NormalizedHolding,
  SnapTradeClient,
  SnapTradeUser,
} from "@investiq/integrations";
import { assertOwnedBy } from "../lib/permissions.js";
import { DEMO_STATUS } from "./demo-portfolio.js";

/**
 * SnapTrade brokerage flows. Read-only (no order placement). The SnapTrade
 * user secret is encrypted at rest; one BrokerageConnection per InvestIQ user
 * (the SnapTrade userId = the InvestIQ user id). All operations are scoped to
 * the owning user.
 */
export interface BrokerageDeps {
  client: SnapTradeClient;
  encKey: string;
  redirectUri?: string;
}

function snaptradeUser(conn: { snaptradeUserId: string; snaptradeSecret: string }, encKey: string): SnapTradeUser {
  return { userId: conn.snaptradeUserId, userSecret: decryptSecret(conn.snaptradeSecret, encKey) };
}

/** Find-or-create the global Symbol for a ticker seen in a holding/transaction. */
async function resolveSymbolId(ticker: string, description: string | null): Promise<string> {
  const t = ticker.toUpperCase();
  const sym = await prisma.symbol.upsert({
    where: { ticker: t },
    update: {},
    create: { ticker: t, name: description ?? t, assetType: "STOCK" },
    select: { id: true },
  });
  return sym.id;
}

/** Start (or resume) a brokerage connection; returns the SnapTrade portal URL. */
export async function startConnection(
  deps: BrokerageDeps,
  userId: string,
): Promise<{ portalUrl: string; connectionId: string }> {
  let conn = await prisma.brokerageConnection.findFirst({ where: { userId } });
  let user: SnapTradeUser;

  if (!conn) {
    // Register under a FRESH unique SnapTrade userId (not the InvestIQ id).
    // SnapTrade user deletion is asynchronous, so reusing a stable id makes a
    // disconnect→reconnect (or any DB/SnapTrade drift) collide with "user
    // already registered". A unique id per registration avoids that entirely.
    const snaptradeUserId = `${userId}-${randomUUID()}`;
    const reg = await deps.client.registerUser(snaptradeUserId);
    conn = await prisma.brokerageConnection.create({
      data: {
        userId,
        snaptradeUserId: reg.userId,
        snaptradeSecret: encryptSecret(reg.userSecret, deps.encKey),
        status: "pending",
      },
    });
    user = reg;
  } else {
    user = snaptradeUser(conn, deps.encKey);
  }

  const portalUrl = await deps.client.connectionPortalUrl(user, deps.redirectUri);
  return { portalUrl, connectionId: conn.id };
}

export async function listConnections(userId: string) {
  return prisma.brokerageConnection.findMany({
    where: { userId },
    select: { id: true, brokerageName: true, status: true, lastSyncedAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Pull accounts/holdings/transactions from SnapTrade and upsert them idempotently. */
export async function syncConnection(
  deps: BrokerageDeps,
  userId: string,
  connectionId?: string,
): Promise<{ accounts: number; holdings: number; transactions: number; holdingsErrors: number }> {
  const conn = connectionId
    ? await prisma.brokerageConnection.findUnique({ where: { id: connectionId } })
    : await prisma.brokerageConnection.findFirst({ where: { userId } });
  assertOwnedBy(userId, conn);

  if (conn!.status === DEMO_STATUS) {
    // Sample data is static — there is no real brokerage to pull from.
    throw errors.validation(
      "This is the demo portfolio — sample data can't be synced. Connect a real brokerage for live holdings.",
    );
  }

  const user = snaptradeUser(conn!, deps.encKey);
  const accounts = await deps.client.listAccounts(user);
  let holdingCount = 0;
  let holdingsErrors = 0;

  for (const a of accounts) {
    // The holdings snapshot carries the reliable cash + total balance
    // (listUserAccounts omits cash for some brokerages, e.g. Alpaca). A single
    // account's holdings endpoint failing (e.g. still preparing on the broker
    // side) must NOT abort the whole sync — record the account from
    // listAccounts and move on. The error handler logs the cause.
    let snapshot: AccountHoldings | null = null;
    try {
      snapshot = await deps.client.getHoldings(user, a.externalId);
    } catch (e) {
      holdingsErrors++;
      console.error(
        `sync: getHoldings failed for account ${a.externalId} (conn ${conn!.id}):`,
        e instanceof Error ? e.message : e,
      );
    }
    const cash = snapshot?.cash ?? a.cash ?? 0;
    const totalValue = snapshot?.totalValue ?? a.totalValue ?? 0;

    const account = await prisma.account.upsert({
      where: { connectionId_externalId: { connectionId: conn!.id, externalId: a.externalId } },
      update: { name: a.name, currency: a.currency, cash, totalValue },
      create: {
        connectionId: conn!.id,
        externalId: a.externalId,
        name: a.name,
        currency: a.currency,
        cash,
        totalValue,
      },
      select: { id: true },
    });

    for (const h of snapshot?.positions ?? []) {
      const symbolId = await resolveSymbolId(h.ticker, h.description);
      await prisma.holding.upsert({
        where: { accountId_symbolId: { accountId: account.id, symbolId } },
        update: { quantity: h.quantity, avgCost: h.avgCost, marketValue: h.marketValue, unrealizedPl: h.unrealizedPl },
        create: {
          accountId: account.id,
          symbolId,
          quantity: h.quantity,
          avgCost: h.avgCost,
          marketValue: h.marketValue,
          unrealizedPl: h.unrealizedPl,
        },
      });
      holdingCount++;
    }
  }

  // Transactions are immutable history — create-if-absent by externalId. Like
  // holdings, a transactions-endpoint failure shouldn't abort an otherwise-good
  // sync (accounts/holdings are already persisted).
  let txns: Awaited<ReturnType<typeof deps.client.getTransactions>> = [];
  try {
    txns = await deps.client.getTransactions(user);
  } catch (e) {
    console.error(`sync: getTransactions failed (conn ${conn!.id}):`, e instanceof Error ? e.message : e);
  }
  const firstAccount = await prisma.account.findFirst({ where: { connectionId: conn!.id }, select: { id: true } });
  let txnCount = 0;
  if (firstAccount) {
    for (const t of txns) {
      const symbolId = t.ticker ? await resolveSymbolId(t.ticker, null) : null;
      await prisma.transaction.upsert({
        where: { externalId: t.externalId },
        update: {},
        create: {
          accountId: firstAccount.id,
          symbolId,
          type: t.type,
          quantity: t.quantity,
          price: t.price,
          amount: t.amount,
          occurredAt: new Date(t.occurredAt),
          externalId: t.externalId,
        },
      });
      txnCount++;
    }
  }

  await prisma.brokerageConnection.update({
    where: { id: conn!.id },
    data: { status: "active", lastSyncedAt: new Date() },
  });

  return { accounts: accounts.length, holdings: holdingCount, transactions: txnCount, holdingsErrors };
}

export async function getAccounts(userId: string) {
  return prisma.account.findMany({
    where: { connection: { userId } },
    include: {
      holdings: {
        include: { symbol: { select: { ticker: true, name: true, assetType: true } } },
        orderBy: { marketValue: "desc" },
      },
    },
  });
}

/** Aggregate portfolio summary across all of a user's connected accounts. */
export async function getPortfolioSummary(userId: string) {
  const accounts = await getAccounts(userId);
  let totalValue = 0;
  let cash = 0;
  let positions = 0;
  for (const a of accounts) {
    totalValue += Number(a.totalValue ?? 0);
    cash += Number(a.cash ?? 0);
    positions += a.holdings.length;
  }
  return {
    accounts: accounts.length,
    positions,
    totalValue,
    cash,
    connected: accounts.length > 0,
  };
}

export async function disconnect(deps: BrokerageDeps, userId: string, connectionId: string) {
  const conn = await prisma.brokerageConnection.findUnique({ where: { id: connectionId } });
  assertOwnedBy(userId, conn);
  // Demo connections have no real SnapTrade user — skip the upstream call.
  if (conn!.status !== DEMO_STATUS) {
    try {
      await deps.client.deleteUser(conn!.snaptradeUserId);
    } catch {
      // best-effort upstream cleanup; still remove our record
    }
  }
  await prisma.brokerageConnection.delete({ where: { id: conn!.id } });
}

export type { NormalizedHolding };
