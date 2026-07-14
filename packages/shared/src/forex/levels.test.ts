import { describe, it, expect } from "vitest";
import { averageTrueRange, suggestedLevels, DEFAULT_STOP_PIPS, STOP_ATR_MULTIPLE } from "./levels.js";

describe("suggestedLevels", () => {
  it("derives an ATR-based stop and an R:R-based target for a buy", () => {
    // EUR/USD entry 1.0850, ATR 0.0060 → stop distance 0.0090 (90 pips), TP 180 pips at 1:2
    const s = suggestedLevels({
      direction: "BUY",
      entryPrice: 1.085,
      pairSymbol: "EUR/USD",
      atr: 0.006,
      preferredRewardRatio: 2,
    })!;
    expect(s.basis).toBe("atr");
    expect(s.stopPrice).toBeCloseTo(1.085 - 0.009, 6);
    expect(s.stopPips).toBeCloseTo(90, 1);
    expect(s.takeProfitPrice).toBeCloseTo(1.085 + 0.018, 6);
    expect(s.takeProfitPips).toBeCloseTo(180, 1);
    expect(s.atrPips).toBeCloseTo(60, 1);
  });

  it("mirrors for a sell and respects the preferred reward ratio", () => {
    const s = suggestedLevels({
      direction: "SELL",
      entryPrice: 1.085,
      pairSymbol: "EUR/USD",
      atr: 0.006,
      preferredRewardRatio: 3,
    })!;
    expect(s.stopPrice).toBeGreaterThan(1.085);
    expect(s.takeProfitPrice).toBeLessThan(1.085);
    expect(s.takeProfitPips / s.stopPips).toBeCloseTo(3, 3);
  });

  it("falls back to category pip defaults without ATR", () => {
    const s = suggestedLevels({
      direction: "BUY",
      entryPrice: 1.085,
      pairSymbol: "EUR/USD",
      category: "MAJOR",
    })!;
    expect(s.basis).toBe("default");
    expect(s.stopPips).toBeCloseTo(DEFAULT_STOP_PIPS.MAJOR, 1);
    expect(s.rewardRatio).toBe(2);
  });

  it("handles JPY pip size", () => {
    const s = suggestedLevels({
      direction: "BUY",
      entryPrice: 145.25,
      pairSymbol: "USD/JPY",
      atr: 1.2, // 120 pips of daily range
    })!;
    expect(s.stopPips).toBeCloseTo(120 * STOP_ATR_MULTIPLE, 1);
    expect(s.stopPrice).toBeCloseTo(145.25 - 1.8, 6);
  });

  it("returns null on unusable entry", () => {
    expect(suggestedLevels({ direction: "BUY", entryPrice: 0, pairSymbol: "EUR/USD" })).toBeNull();
  });
});

describe("averageTrueRange", () => {
  it("averages true ranges including gap moves", () => {
    const atr = averageTrueRange(
      [
        { high: 1.09, low: 1.08, close: 1.085 },
        { high: 1.091, low: 1.083, close: 1.09 }, // TR = 0.008
        { high: 1.1, low: 1.095, close: 1.098 }, // gap: TR = max(0.005, |1.1-1.09|=0.01, ...) = 0.01
      ],
      14,
    );
    expect(atr).toBeCloseTo((0.008 + 0.01) / 2, 6);
  });

  it("returns null with fewer than 2 candles", () => {
    expect(averageTrueRange([{ high: 1, low: 0.9, close: 0.95 }])).toBeNull();
    expect(averageTrueRange([])).toBeNull();
  });
});
