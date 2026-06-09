import { describe, expect, it } from "vitest";
import { applyFill, computeEquity, validateOrder } from "./paper.js";

describe("validateOrder", () => {
  it("rejects a buy that exceeds cash", () => {
    const v = validateOrder({ side: "BUY", qty: 10, price: 100, cash: 500, position: null });
    expect(v).toEqual({ ok: false, reason: "INSUFFICIENT_FUNDS", message: expect.any(String) });
  });

  it("allows a buy within cash", () => {
    expect(validateOrder({ side: "BUY", qty: 4, price: 100, cash: 500, position: null })).toEqual({ ok: true });
  });

  it("rejects selling more shares than held", () => {
    const v = validateOrder({ side: "SELL", qty: 5, price: 100, cash: 0, position: { qty: 3, avgPrice: 90 } });
    expect(v).toEqual({ ok: false, reason: "INSUFFICIENT_SHARES", message: expect.any(String) });
  });

  it("rejects non-positive qty/price", () => {
    expect(validateOrder({ side: "BUY", qty: 0, price: 100, cash: 100, position: null }).ok).toBe(false);
  });
});

describe("applyFill", () => {
  it("buys and averages in", () => {
    const first = applyFill({ side: "BUY", qty: 10, price: 100, cash: 100_000, position: null });
    expect(first.cash).toBe(99_000);
    expect(first.position).toEqual({ qty: 10, avgPrice: 100 });

    const second = applyFill({ side: "BUY", qty: 10, price: 120, cash: first.cash, position: first.position });
    expect(second.position).toEqual({ qty: 20, avgPrice: 110 });
    expect(second.cash).toBe(97_800);
    expect(second.realizedPl).toBe(0);
  });

  it("sells, realizes P&L, and keeps the average on a partial close", () => {
    const r = applyFill({ side: "SELL", qty: 5, price: 130, cash: 0, position: { qty: 20, avgPrice: 110 } });
    expect(r.cash).toBe(650);
    expect(r.realizedPl).toBe(100); // (130-110)*5
    expect(r.position).toEqual({ qty: 15, avgPrice: 110 });
  });

  it("clears the position on a full close", () => {
    const r = applyFill({ side: "SELL", qty: 15, price: 130, cash: 650, position: { qty: 15, avgPrice: 110 } });
    expect(r.position).toBeNull();
    expect(r.realizedPl).toBe(300);
  });
});

describe("computeEquity", () => {
  it("uses live price when present, falling back to avg cost", () => {
    const eq = computeEquity(1_000, [
      { qty: 10, price: 120, avgPrice: 100 },
      { qty: 5, price: null, avgPrice: 50 },
    ]);
    expect(eq).toBe(1_000 + 1_200 + 250);
  });
});
