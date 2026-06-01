import { describe, it, expect } from "vitest";
import {
  extractTicker,
  normalizeAccount,
  normalizePosition,
  normalizeActivity,
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
