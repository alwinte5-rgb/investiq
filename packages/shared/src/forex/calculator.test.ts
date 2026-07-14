import { describe, it, expect } from "vitest";
import { computeTradeCalc } from "./calculator.js";

/** The product's reference case: $2,000 USD account, 1% risk, EUR/USD @ 1.0850, 25-pip stop, 50:1. */
const REFERENCE = {
  accountBalance: 2000,
  accountCurrency: "USD",
  pairSymbol: "EUR/USD",
  direction: "BUY" as const,
  entryPrice: 1.085,
  stopLossPips: 25,
  riskPercentage: 1,
  leverage: 50,
};

describe("computeTradeCalc — reference case", () => {
  it("produces the spec's expected numbers", () => {
    const r = computeTradeCalc(REFERENCE);
    expect(r.maxSelectedRiskAmount).toBe(20);
    expect(r.stopPips).toBeCloseTo(25, 1);
    expect(r.recommendedUnits).toBe(8000);
    expect(r.recommendedLots).toBeCloseTo(0.08, 6);
    expect(r.pipValue).toBeCloseTo(0.8, 2);
    expect(r.actualRiskAmount).toBeCloseTo(20, 0);
    expect(r.notionalValue).toBeCloseTo(8680, 0);
    expect(r.requiredMargin).toBeCloseTo(173.6, 1);
    expect(r.effectiveLeverage).toBeCloseTo(4.34, 2);
    expect(r.resolvedStopPrice).toBeCloseTo(1.0825, 6);
    expect(r.status.status).toBe("WITHIN_PLAN");
    expect(r.warnings).toHaveLength(0);
  });

  it("writes a dynamic plain-language summary with the key numbers", () => {
    const r = computeTradeCalc(REFERENCE);
    expect(r.summary).toBeTruthy();
    expect(r.summary).toContain("EUR/USD");
    expect(r.summary).toContain("$8,680");
    expect(r.summary).toContain("$20");
    expect(r.summary).toContain("50:1");
    expect(r.summary).toContain("not your maximum loss");
  });
});

describe("computeTradeCalc — stops, targets, and synchronization", () => {
  it("derives pips from a stop price (price wins over pips) and vice versa", () => {
    const fromPrice = computeTradeCalc({ ...REFERENCE, stopLossPips: null, stopLossPrice: 1.0825 });
    expect(fromPrice.stopPips).toBeCloseTo(25, 1);
    const both = computeTradeCalc({ ...REFERENCE, stopLossPips: 99, stopLossPrice: 1.0825 });
    expect(both.stopPips).toBeCloseTo(25, 1);
  });

  it("computes reward metrics from a take profit (1:2 → break-even ≈ 33.3%)", () => {
    const r = computeTradeCalc({ ...REFERENCE, takeProfitPips: 50 });
    expect(r.takeProfitPips).toBeCloseTo(50, 1);
    expect(r.resolvedTakeProfitPrice).toBeCloseTo(1.09, 6);
    expect(r.potentialProfit).toBeCloseTo(40, 0);
    expect(r.riskReward).toBeCloseTo(2, 2);
    expect(r.riskRewardLabel).toBe("1:2");
    expect(r.breakEvenWinRatePct).toBeCloseTo(33.3, 1);
  });

  it("warns on an inverted stop but still calculates", () => {
    const r = computeTradeCalc({ ...REFERENCE, stopLossPips: null, stopLossPrice: 1.09 });
    expect(r.warnings.some((w) => w.includes("below the entry"))).toBe(true);
    expect(r.stopPips).toBeCloseTo(50, 1);
    expect(r.recommendedUnits).toBeGreaterThan(0);
  });
});

describe("computeTradeCalc — overrides recompute true risk", () => {
  it("a larger manual size raises the actual risk above the selected budget and warns", () => {
    const r = computeTradeCalc({ ...REFERENCE, positionUnitsOverride: 16000 });
    expect(r.units).toBe(16000);
    expect(r.actualRiskAmount).toBeCloseTo(40, 0);
    expect(r.actualRiskPct).toBeCloseTo(2, 1);
    expect(r.warnings.some((w) => w.includes("manual position size"))).toBe(true);
  });

  it("a lot-size override converts to units (lot override wins)", () => {
    const r = computeTradeCalc({ ...REFERENCE, lotSizeOverride: 0.05, positionUnitsOverride: 999 });
    expect(r.units).toBe(5000);
    expect(r.actualRiskAmount).toBeCloseTo(12.5, 1);
  });
});

describe("computeTradeCalc — status integration", () => {
  it("MISSING_INFO when the stop is absent", () => {
    const r = computeTradeCalc({ ...REFERENCE, stopLossPips: null });
    expect(r.status.status).toBe("MISSING_INFO");
  });

  it("OUTSIDE_PLAN when risk exceeds the user's max", () => {
    const r = computeTradeCalc({ ...REFERENCE, riskPercentage: 5, defaultRiskPct: 1, maxRiskPct: 2 });
    expect(r.status.status).toBe("OUTSIDE_PLAN");
  });

  it("CAUTION between default and max", () => {
    const r = computeTradeCalc({ ...REFERENCE, riskPercentage: 1.5, defaultRiskPct: 1, maxRiskPct: 2 });
    expect(r.status.status).toBe("CAUTION");
  });

  it("never uses the word 'safe' in status output", () => {
    const r = computeTradeCalc({ ...REFERENCE, defaultRiskPct: 1, maxRiskPct: 2 });
    const text = [r.status.label, ...r.status.reasons, ...(r.summary ? [r.summary] : [])].join(" ").toLowerCase();
    expect(text).not.toMatch(/\bsafe\b/);
  });
});

describe("computeTradeCalc — cross-currency accounts", () => {
  it("EUR account trading GBP/JPY sizes via cross rates", () => {
    const r = computeTradeCalc({
      accountBalance: 5000,
      accountCurrency: "EUR",
      pairSymbol: "GBP/JPY",
      direction: "SELL",
      entryPrice: 185.0,
      stopLossPips: 30,
      riskPercentage: 1,
      leverage: 30,
      rates: { "EUR/USD": 1.085, "USD/JPY": 145.0, "GBP/USD": 1.27 },
    });
    // pip value per unit = 0.01 JPY → EUR: 0.01 × (1/145) × (1/1.085) ≈ 0.00006357 EUR
    // risk = €50; units = floor(50 / (30 × 0.00006357)) ≈ 26,215
    expect(r.recommendedUnits).toBeGreaterThan(26000);
    expect(r.recommendedUnits).toBeLessThan(26500);
    expect(r.status.status).not.toBe("MISSING_INFO");
  });

  it("reports MISSING_INFO with a rate explanation when conversion is impossible", () => {
    const r = computeTradeCalc({ ...REFERENCE, accountCurrency: "CHF" });
    expect(r.status.status).toBe("MISSING_INFO");
    expect(r.status.reasons.join(" ")).toContain("exchange rate");
  });
});

describe("computeTradeCalc — costs", () => {
  it("nets entered spread/commission/swap from the reward", () => {
    const r = computeTradeCalc({ ...REFERENCE, takeProfitPips: 50, spreadPips: 1, commission: 4, swap: 0.5 });
    expect(r.costs.spreadCost).toBeCloseTo(0.8, 1);
    expect(r.costs.total).toBeCloseTo(5.3, 1);
    expect(r.netPotentialProfit).toBeCloseTo(34.7, 1);
  });
});
