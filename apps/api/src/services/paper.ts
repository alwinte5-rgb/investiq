import { prisma } from "@investiq/db";
import {
  PAPER_STARTING_CASH,
  applyFill,
  computeEquity,
  errors,
  validateOrder,
  type PaperOrderInput,
  type PaperOrderSide,
} from "@investiq/shared";
import type { MarketService } from "./market.js";
import { findSymbolByTicker } from "./symbols.js";

/**
 * Layer 9 — Paper Trading (self-contained simulator). NO live trading path
 * exists: orders fill against a live *quote* but cash, positions and equity are
 * our own ledger (`alpacaAccountId` stays null). Pipeline per submit: authorize
 * the user's own account -> validate -> idempotent fill -> persist position +
 * cash + order + equity snapshot. Rejections (insufficient funds/shares) are
 * surfaced honestly as a stored `rejected` order, never a thrown error.
 * Educational only.
 */

export interface PaperDeps {
  market: MarketService;
}

const num = (v: unknown): number => Number(v ?? 0) || 0;
/** UTC midnight key for the daily equity snapshot. */
function todayKey(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** One simulated account per user; created lazily with starting cash. */
async function getOrCreateAccount(userId: string) {
  const existing = await prisma.paperAccount.findFirst({ where: { userId } });
  if (existing) return existing;
  return prisma.paperAccount.create({
    data: { userId, cash: PAPER_STARTING_CASH, equity: PAPER_STARTING_CASH },
  });
}

export interface PaperPositionView {
  ticker: string;
  qty: number;
  avgPrice: number;
  price: number | null;
  marketValue: number;
  unrealizedPl: number;
}
export interface PaperAccountView {
  cash: number;
  equity: number;
  startingCash: number;
  totalPl: number;
  totalPlPct: number;
  positions: PaperPositionView[];
}

/** Account snapshot with positions valued at live quotes (best-effort). */
export async function getPaperAccount(userId: string, deps: PaperDeps): Promise<PaperAccountView> {
  const account = await getOrCreateAccount(userId);
  const positions = await prisma.paperPosition.findMany({ where: { accountId: account.id } });

  const priced = await Promise.all(
    positions.map(async (p) => {
      let price: number | null = null;
      try {
        price = num((await deps.market.getQuote(p.symbolTicker)).price) || null;
      } catch {
        /* no live price — fall back to avg cost */
      }
      const avgPrice = num(p.avgPrice);
      const qty = num(p.qty);
      const mark = price != null && price > 0 ? price : avgPrice;
      return {
        ticker: p.symbolTicker,
        qty,
        avgPrice,
        price,
        marketValue: Math.round(qty * mark * 100) / 100,
        unrealizedPl: Math.round((mark - avgPrice) * qty * 100) / 100,
      };
    }),
  );

  const cash = num(account.cash);
  const equity = computeEquity(
    cash,
    priced.map((p) => ({ qty: p.qty, price: p.price, avgPrice: p.avgPrice })),
  );
  const startingCash = PAPER_STARTING_CASH;
  const totalPl = Math.round((equity - startingCash) * 100) / 100;

  return {
    cash,
    equity,
    startingCash,
    totalPl,
    totalPlPct: Math.round((totalPl / startingCash) * 10000) / 100,
    positions: priced,
  };
}

export interface SubmitOrderResult {
  status: "filled" | "rejected";
  orderId: string;
  ticker: string;
  side: PaperOrderSide;
  qty: number;
  filledPrice: number | null;
  reason?: string;
  duplicate?: boolean;
}

/**
 * Submit a market order. Idempotent when an `idempotencyKey` is supplied: the key
 * maps to a unique `externalId`, so a retried/duplicate submit returns the
 * original order instead of filling twice.
 */
export async function submitOrder(
  userId: string,
  input: PaperOrderInput,
  deps: PaperDeps,
): Promise<SubmitOrderResult> {
  const symbol = await findSymbolByTicker(input.ticker);
  if (!symbol) throw errors.notFound(`Unknown or unsupported symbol: ${input.ticker}`);
  const ticker = input.ticker.toUpperCase();

  const account = await getOrCreateAccount(userId);
  const externalId = input.idempotencyKey ? `${account.id}:${input.idempotencyKey}` : null;

  // Idempotency short-circuit: same key → return the original order.
  if (externalId) {
    const prior = await prisma.paperOrder.findUnique({ where: { externalId } });
    if (prior) {
      return {
        status: prior.status === "filled" ? "filled" : "rejected",
        orderId: prior.id,
        ticker: prior.symbolTicker,
        side: prior.side as PaperOrderSide,
        qty: num(prior.qty),
        filledPrice: prior.filledPrice != null ? num(prior.filledPrice) : null,
        duplicate: true,
      };
    }
  }

  // A fill needs a real price; absence is a system condition, not a user rejection.
  let price = 0;
  try {
    price = num((await deps.market.getQuote(ticker)).price);
  } catch {
    /* handled below */
  }
  if (!(price > 0)) {
    throw errors.upstream("No market price available to fill this order. Try again shortly.");
  }

  const position = await prisma.paperPosition.findUnique({
    where: { accountId_symbolTicker: { accountId: account.id, symbolTicker: ticker } },
  });
  const positionState = position ? { qty: num(position.qty), avgPrice: num(position.avgPrice) } : null;

  const check = validateOrder({
    side: input.side,
    qty: input.qty,
    price,
    cash: num(account.cash),
    position: positionState,
  });

  // Honest rejection — persisted as a `rejected` order, returned as 200.
  if (!check.ok) {
    const rejected = await prisma.paperOrder.create({
      data: {
        accountId: account.id,
        symbolTicker: ticker,
        side: input.side,
        qty: input.qty,
        type: input.type,
        status: "rejected",
        externalId,
      },
    });
    return {
      status: "rejected",
      orderId: rejected.id,
      ticker,
      side: input.side,
      qty: input.qty,
      filledPrice: null,
      reason: check.message,
    };
  }

  const fill = applyFill({
    side: input.side,
    qty: input.qty,
    price,
    cash: num(account.cash),
    position: positionState,
  });

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Position: upsert or delete on full close.
      if (fill.position) {
        const mv = Math.round(fill.position.qty * price * 100) / 100;
        await tx.paperPosition.upsert({
          where: { accountId_symbolTicker: { accountId: account.id, symbolTicker: ticker } },
          update: {
            qty: fill.position.qty,
            avgPrice: fill.position.avgPrice,
            marketValue: mv,
            unrealizedPl: Math.round((price - fill.position.avgPrice) * fill.position.qty * 100) / 100,
          },
          create: {
            accountId: account.id,
            symbolTicker: ticker,
            qty: fill.position.qty,
            avgPrice: fill.position.avgPrice,
            marketValue: mv,
            unrealizedPl: Math.round((price - fill.position.avgPrice) * fill.position.qty * 100) / 100,
          },
        });
      } else if (position) {
        await tx.paperPosition.delete({
          where: { accountId_symbolTicker: { accountId: account.id, symbolTicker: ticker } },
        });
      }

      // Equity from cost basis of remaining positions (live re-mark happens on read).
      const remaining = await tx.paperPosition.findMany({ where: { accountId: account.id } });
      const equity = computeEquity(
        fill.cash,
        remaining.map((p) => ({
          qty: num(p.qty),
          price: num(p.marketValue) > 0 ? num(p.marketValue) / num(p.qty) : null,
          avgPrice: num(p.avgPrice),
        })),
      );

      await tx.paperAccount.update({
        where: { id: account.id },
        data: { cash: fill.cash, equity },
      });

      // Daily equity curve point (idempotent per day).
      await tx.paperPerformanceSnapshot.upsert({
        where: { accountId_date: { accountId: account.id, date: todayKey() } },
        update: { equity },
        create: { accountId: account.id, date: todayKey(), equity },
      });

      return tx.paperOrder.create({
        data: {
          accountId: account.id,
          symbolTicker: ticker,
          side: input.side,
          qty: input.qty,
          type: input.type,
          status: "filled",
          filledAt: new Date(),
          filledPrice: price,
          externalId,
        },
      });
    });

    return {
      status: "filled",
      orderId: order.id,
      ticker,
      side: input.side,
      qty: input.qty,
      filledPrice: price,
    };
  } catch (e) {
    // Concurrent duplicate submit (same idempotency key) — return the winner.
    if ((e as { code?: string }).code === "P2002" && externalId) {
      const prior = await prisma.paperOrder.findUnique({ where: { externalId } });
      if (prior) {
        return {
          status: prior.status === "filled" ? "filled" : "rejected",
          orderId: prior.id,
          ticker: prior.symbolTicker,
          side: prior.side as PaperOrderSide,
          qty: num(prior.qty),
          filledPrice: prior.filledPrice != null ? num(prior.filledPrice) : null,
          duplicate: true,
        };
      }
    }
    throw e;
  }
}

export interface PaperOrderView {
  id: string;
  ticker: string;
  side: PaperOrderSide;
  qty: number;
  type: string;
  status: string;
  filledPrice: number | null;
  submittedAt: string;
  filledAt: string | null;
}

/** Order history, newest first. */
export async function listOrders(userId: string, limit = 50): Promise<PaperOrderView[]> {
  const account = await getOrCreateAccount(userId);
  const orders = await prisma.paperOrder.findMany({
    where: { accountId: account.id },
    orderBy: { submittedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
  return orders.map((o) => ({
    id: o.id,
    ticker: o.symbolTicker,
    side: o.side as PaperOrderSide,
    qty: num(o.qty),
    type: o.type,
    status: o.status,
    filledPrice: o.filledPrice != null ? num(o.filledPrice) : null,
    submittedAt: o.submittedAt.toISOString(),
    filledAt: o.filledAt ? o.filledAt.toISOString() : null,
  }));
}

export interface EquityPoint {
  date: string;
  equity: number;
}
/** Equity curve (daily snapshots), oldest first. */
export async function getEquityCurve(userId: string): Promise<EquityPoint[]> {
  const account = await getOrCreateAccount(userId);
  const snaps = await prisma.paperPerformanceSnapshot.findMany({
    where: { accountId: account.id },
    orderBy: { date: "asc" },
  });
  return snaps.map((s) => ({ date: s.date.toISOString(), equity: num(s.equity) }));
}
