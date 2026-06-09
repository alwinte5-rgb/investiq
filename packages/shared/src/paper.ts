/**
 * Layer 9 — Paper Trading (deterministic trade math).
 *
 * PURE simulation math: order validation, position averaging, realized P&L, and
 * equity — no I/O, no clock, no broker. V1 is a SELF-CONTAINED simulator (no live
 * trading path exists): orders fill at a supplied quote, cash and positions are
 * our own ledger. The service layer wraps these with persistence + idempotency.
 * Educational only.
 */

/** Starting simulated cash for a new paper account. */
export const PAPER_STARTING_CASH = 100_000;

export type PaperOrderSide = "BUY" | "SELL";

export interface PaperPositionState {
  qty: number;
  avgPrice: number;
}

export type OrderRejectReason = "INSUFFICIENT_FUNDS" | "INSUFFICIENT_SHARES" | "INVALID";

export type OrderValidation = { ok: true } | { ok: false; reason: OrderRejectReason; message: string };

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Round share quantities to 4 dp (supports fractional shares) and clamp tiny FP dust. */
const roundQty = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * Validate an order against current cash + position. A buy needs enough cash for
 * `qty * price`; a sell needs enough shares. Returns a typed rejection (surfaced
 * honestly to the user) rather than throwing.
 */
export function validateOrder(args: {
  side: PaperOrderSide;
  qty: number;
  price: number;
  cash: number;
  position: PaperPositionState | null;
}): OrderValidation {
  const { side, qty, price, cash, position } = args;
  if (!(qty > 0) || !(price > 0)) {
    return { ok: false, reason: "INVALID", message: "Quantity and price must be positive." };
  }
  if (side === "BUY") {
    const cost = qty * price;
    if (cost > cash + 1e-6) {
      return {
        ok: false,
        reason: "INSUFFICIENT_FUNDS",
        message: `Not enough simulated cash: need $${round2(cost)}, have $${round2(cash)}.`,
      };
    }
    return { ok: true };
  }
  // SELL
  const held = position?.qty ?? 0;
  if (qty > held + 1e-6) {
    return {
      ok: false,
      reason: "INSUFFICIENT_SHARES",
      message: `Not enough shares: trying to sell ${qty}, hold ${held}.`,
    };
  }
  return { ok: true };
}

export interface FillResult {
  /** New cash after the fill. */
  cash: number;
  /** New position (null when fully closed). */
  position: PaperPositionState | null;
  /** Realized P&L on a sell (0 for buys). */
  realizedPl: number;
}

/**
 * Apply a VALIDATED fill to cash + position. Buys lower cash and average up/in;
 * sells raise cash, reduce shares, and realize P&L against the average price.
 * Must be called only after `validateOrder` returns ok.
 */
export function applyFill(args: {
  side: PaperOrderSide;
  qty: number;
  price: number;
  cash: number;
  position: PaperPositionState | null;
}): FillResult {
  const { side, qty, price, cash, position } = args;
  const held = position?.qty ?? 0;
  const avg = position?.avgPrice ?? 0;

  if (side === "BUY") {
    const newQty = roundQty(held + qty);
    const newAvg = newQty > 0 ? round2((held * avg + qty * price) / newQty) : 0;
    return {
      cash: round2(cash - qty * price),
      position: { qty: newQty, avgPrice: newAvg },
      realizedPl: 0,
    };
  }

  // SELL
  const newQty = roundQty(held - qty);
  const realizedPl = round2((price - avg) * qty);
  return {
    cash: round2(cash + qty * price),
    position: newQty > 0 ? { qty: newQty, avgPrice: round2(avg) } : null,
    realizedPl,
  };
}

/** Total equity = cash + market value of all positions at the given prices. */
export function computeEquity(
  cash: number,
  positions: { qty: number; price: number | null; avgPrice: number }[],
): number {
  const invested = positions.reduce(
    (acc, p) => acc + p.qty * (p.price != null && p.price > 0 ? p.price : p.avgPrice),
    0,
  );
  return round2(cash + invested);
}
