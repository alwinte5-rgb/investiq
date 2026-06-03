import { describe, it, expect } from "vitest";
import {
  extractTicker,
  normalizeAccount,
  normalizePosition,
  normalizeActivity,
  normalizeHoldingsSnapshot,
} from "./snaptrade.js";

describe("snaptrade normalizers", () => {
  it("extractTicker digs through SnapTrade's nested symbol shape", () => {
    expect(extractTicker({ symbol: { symbol: { symbol: "AAPL" } } })).toBe("AAPL");
    expect(extractTicker({ symbol: { raw_symbol: "MSFT" } })).toBe("MSFT");
    expect(extractTicker({})).toBeNull();
  });

  it("normalizeAccount flattens balance + currency", () => {
    const a = normalizeAccount({
      id: "acc1",
      name: "Brokerage",
      number: "Z123",
      balance: { total: { amount: 10500.25, currency: "USD" } },
      institution_name: "Alpaca",
    });
    expect(a).toMatchObject({
      externalId: "acc1",
      name: "Brokerage",
      currency: "USD",
      totalValue: 10500.25,
      brokerage: "Alpaca",
    });
  });

  it("normalizePosition computes market value and skips symbol-less rows", () => {
    const h = normalizePosition({
      symbol: { symbol: { symbol: "nvda", description: "NVIDIA" } },
      units: 10,
      price: 190.5,
      average_purchase_price: 150,
      open_pnl: 405,
    });
    expect(h).toMatchObject({ ticker: "NVDA", quantity: 10, price: 190.5, marketValue: 1905, avgCost: 150 });
    expect(normalizePosition({ units: 5, price: 1 })).toBeNull(); // no symbol
  });

  it("normalizeHoldingsSnapshot pulls cash from balances on an empty paper account", () => {
    // A fresh Alpaca paper account: $100k cash, no positions.
    const snap = normalizeHoldingsSnapshot({
      positions: [],
      balances: [{ currency: { code: "USD" }, cash: 100000 }],
      total_value: { amount: 100000, currency: "USD" },
    });
    expect(snap.positions).toEqual([]);
    expect(snap.cash).toBe(100000);
    expect(snap.totalValue).toBe(100000);
  });

  it("normalizeHoldingsSnapshot sums multi-currency cash and keeps positions", () => {
    const snap = normalizeHoldingsSnapshot({
      positions: [{ symbol: { symbol: { symbol: "AAPL" } }, units: 2, price: 100 }],
      balances: [{ cash: 500 }, { cash: 250 }],
      total_value: { amount: 950 },
    });
    expect(snap.cash).toBe(750);
    expect(snap.positions).toHaveLength(1);
    expect(snap.positions[0]).toMatchObject({ ticker: "AAPL", marketValue: 200 });
  });

  it("normalizeHoldingsSnapshot returns null cash when no balances are present", () => {
    const snap = normalizeHoldingsSnapshot({ positions: [], total_value: { amount: 0 } });
    expect(snap.cash).toBeNull();
  });

  it("normalizeActivity maps a trade and derives an externalId fallback", () => {
    const t = normalizeActivity({
      type: "BUY",
      symbol: { symbol: { symbol: "AAPL" } },
      units: 3,
      price: 189,
      amount: -567,
      currency: { code: "USD" },
      trade_date: "2026-05-30T00:00:00Z",
    });
    expect(t).toMatchObject({ type: "buy", ticker: "AAPL", quantity: 3, amount: -567, currency: "USD" });
    expect(t.occurredAt).toBe("2026-05-30T00:00:00.000Z");
  });
});
