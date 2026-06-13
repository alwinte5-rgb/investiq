"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

export interface PaperPosition {
  ticker: string;
  qty: number;
  avgPrice: number;
  price: number | null;
  marketValue: number;
  unrealizedPl: number;
}

export interface PaperAccount {
  cash: number;
  equity: number;
  startingCash: number;
  totalPl: number;
  totalPlPct: number;
  positions: PaperPosition[];
}

export interface PaperOrder {
  id: string;
  ticker: string;
  side: "BUY" | "SELL";
  qty: number;
  type: string;
  status: string;
  filledPrice: number | null;
  submittedAt: string;
  filledAt: string | null;
}

export interface EquityPoint {
  date: string;
  equity: number;
}

export interface SubmitOrderResult {
  status: "filled" | "rejected";
  orderId: string;
  ticker: string;
  side: "BUY" | "SELL";
  qty: number;
  filledPrice: number | null;
  reason?: string;
  duplicate?: boolean;
}

export type AccountResult =
  | { ok: true; account: PaperAccount }
  | { ok: false; error: string };

export type OrdersResult =
  | { ok: true; orders: PaperOrder[] }
  | { ok: false; error: string };

export type CurveResult =
  | { ok: true; points: EquityPoint[] }
  | { ok: false; error: string };

export type OrderResult =
  | { ok: true; result: SubmitOrderResult }
  | { ok: false; error: string };

export interface Quote {
  ticker: string;
  price: number;
  change: number | null;
  changePct: number | null;
}
export type QuoteResult = { ok: true; quote: Quote } | { ok: false; error: string };

function authRedirect(msg: string) {
  if (/authentication required|unauthorized|\b401\b/i.test(msg)) redirect("/sign-in");
}

/** Live quote for the ticker being ordered, so the ticket shows the fill price. */
export async function getQuoteAction(ticker: string): Promise<QuoteResult> {
  const t = ticker.trim().toUpperCase();
  if (!t) return { ok: false, error: "Enter a ticker" };
  try {
    const quote = await apiFetch<Quote>(`/api/v1/symbols/${encodeURIComponent(t)}/quote`);
    return { ok: true, quote };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No quote available";
    authRedirect(msg);
    return { ok: false, error: msg };
  }
}

/** Account snapshot: cash, equity, P&L and positions valued at live quotes. */
export async function getPaperAccountAction(): Promise<AccountResult> {
  try {
    const account = await apiFetch<PaperAccount>("/api/v1/paper/account");
    return { ok: true, account };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load account";
    authRedirect(msg);
    return { ok: false, error: msg };
  }
}

/** Order history, newest first. */
export async function getPaperOrdersAction(): Promise<OrdersResult> {
  try {
    const orders = await apiFetch<PaperOrder[]>("/api/v1/paper/orders");
    return { ok: true, orders };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load orders";
    authRedirect(msg);
    return { ok: false, error: msg };
  }
}

/** Daily equity curve, oldest first. */
export async function getPaperPerformanceAction(): Promise<CurveResult> {
  try {
    const points = await apiFetch<EquityPoint[]>("/api/v1/paper/performance");
    return { ok: true, points };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load performance";
    authRedirect(msg);
    return { ok: false, error: msg };
  }
}

/**
 * Submit a simulated market order. An idempotencyKey is generated client-side
 * intent is single-submit; the server dedupes retries by that key so a double
 * click cannot fill twice.
 */
export async function submitPaperOrderAction(input: {
  ticker: string;
  side: "BUY" | "SELL";
  qty: number;
  idempotencyKey: string;
}): Promise<OrderResult> {
  try {
    const result = await apiFetch<SubmitOrderResult>("/api/v1/paper/orders", {
      method: "POST",
      body: JSON.stringify({
        ticker: input.ticker,
        side: input.side,
        qty: input.qty,
        type: "market",
        idempotencyKey: input.idempotencyKey,
      }),
    });
    return { ok: true, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to submit order";
    authRedirect(msg);
    return { ok: false, error: msg };
  }
}
