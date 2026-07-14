import { describe, it, expect } from "vitest";
import {
  riskAmount,
  stopLossPips,
  takeProfitPips,
  stopPriceFromPips,
  takeProfitPriceFromPips,
  pipValuePerUnit,
  pipValueForUnits,
  positionSizeUnits,
  unitsToLots,
  lotsToUnits,
  lotBreakdown,
  describeUnits,
} from "./position.js";
import { notionalValue, requiredMargin, effectiveLeverage, freeMargin, formatLeverage } from "./margin.js";

describe("risk amount", () => {
  it("is balance × risk percent", () => {
    expect(riskAmount(2000, 1)).toBe(20);
    expect(riskAmount(10000, 2.5)).toBe(250);
  });
  it("is zero for unusable inputs", () => {
    expect(riskAmount(0, 1)).toBe(0);
    expect(riskAmount(2000, 0)).toBe(0);
    expect(riskAmount(-5, 1)).toBe(0);
  });
});

describe("stop-loss distance", () => {
  it("buy: |entry − stop| ÷ pip size, no warning when stop is below entry", () => {
    const r = stopLossPips({ direction: "BUY", entryPrice: 1.085, stopPrice: 1.0825, pipSize: 0.0001 });
    expect(r.pips).toBeCloseTo(25, 6);
    expect(r.directionWarning).toBeNull();
  });

  it("sell: |stop − entry| ÷ pip size, no warning when stop is above entry", () => {
    const r = stopLossPips({ direction: "SELL", entryPrice: 1.085, stopPrice: 1.088, pipSize: 0.0001 });
    expect(r.pips).toBeCloseTo(30, 6);
    expect(r.directionWarning).toBeNull();
  });

  it("warns (does not block) when the stop is on the unusual side", () => {
    const buy = stopLossPips({ direction: "BUY", entryPrice: 1.085, stopPrice: 1.09, pipSize: 0.0001 });
    expect(buy.pips).toBeCloseTo(50, 6);
    expect(buy.directionWarning).toMatch(/below the entry/);

    const sell = stopLossPips({ direction: "SELL", entryPrice: 1.085, stopPrice: 1.08, pipSize: 0.0001 });
    expect(sell.pips).toBeCloseTo(50, 6);
    expect(sell.directionWarning).toMatch(/above the entry/);
  });

  it("take-profit warnings mirror the stop rules", () => {
    expect(
      takeProfitPips({ direction: "BUY", entryPrice: 1.085, stopPrice: 1.08, pipSize: 0.0001 }).directionWarning
    ).toMatch(/above the entry/);
    expect(
      takeProfitPips({ direction: "SELL", entryPrice: 1.085, stopPrice: 1.08, pipSize: 0.0001 }).directionWarning
    ).toBeNull();
  });

  it("resolves prices from pip distances direction-aware", () => {
    expect(stopPriceFromPips("BUY", 1.085, 25, 0.0001)).toBeCloseTo(1.0825, 10);
    expect(stopPriceFromPips("SELL", 1.085, 25, 0.0001)).toBeCloseTo(1.0875, 10);
    expect(takeProfitPriceFromPips("BUY", 1.085, 50, 0.0001)).toBeCloseTo(1.09, 10);
    expect(takeProfitPriceFromPips("SELL", 1.085, 50, 0.0001)).toBeCloseTo(1.08, 10);
  });
});

describe("pip value across account currencies", () => {
  it("account = quote currency (USD account, EUR/USD)", () => {
    const pv = pipValuePerUnit({ pairSymbol: "EUR/USD", accountCurrency: "USD", rates: { "EUR/USD": 1.085 } });
    expect(pv).toBeCloseTo(0.0001, 10);
    expect(pipValueForUnits(10000, { pairSymbol: "EUR/USD", accountCurrency: "USD", rates: { "EUR/USD": 1.085 } })).toBeCloseTo(1, 6);
  });

  it("account = base currency (EUR account, EUR/USD) converts via the pair itself", () => {
    const pv = pipValuePerUnit({ pairSymbol: "EUR/USD", accountCurrency: "EUR", rates: { "EUR/USD": 1.085 } });
    // 0.0001 USD → EUR at 1/1.085
    expect(pv).toBeCloseTo(0.0001 / 1.085, 10);
  });

  it("account differs from both (GBP account, EUR/USD) uses a cross rate", () => {
    const rates = { "EUR/USD": 1.085, "GBP/USD": 1.27 };
    const pv = pipValuePerUnit({ pairSymbol: "EUR/USD", accountCurrency: "GBP", rates });
    // USD → GBP = 1/1.27
    expect(pv).toBeCloseTo(0.0001 / 1.27, 10);
  });

  it("JPY pair with USD account converts the 0.01 pip", () => {
    const pv = pipValuePerUnit({ pairSymbol: "USD/JPY", accountCurrency: "USD", rates: { "USD/JPY": 145 } });
    // 0.01 JPY → USD at 1/145
    expect(pv).toBeCloseTo(0.01 / 145, 10);
  });

  it("returns null when the rate table cannot convert", () => {
    expect(pipValuePerUnit({ pairSymbol: "EUR/USD", accountCurrency: "CHF", rates: { "EUR/USD": 1.085 } })).toBeNull();
  });
});

describe("position sizing", () => {
  it("reference case: $2,000, 1%, EUR/USD, 25-pip stop → ~8,000 units / 0.08 lots / ~$0.80 per pip", () => {
    const rates = { "EUR/USD": 1.085 };
    const risk = riskAmount(2000, 1);
    expect(risk).toBe(20);
    const units = positionSizeUnits({ riskAmount: risk, stopPips: 25, pairSymbol: "EUR/USD", accountCurrency: "USD", rates });
    expect(units).toBe(8000);
    expect(unitsToLots(units!)).toBeCloseTo(0.08, 6);
    const pipValue = pipValueForUnits(units!, { pairSymbol: "EUR/USD", accountCurrency: "USD", rates });
    expect(pipValue).toBeCloseTo(0.8, 2);
  });

  it("JPY reference: USD account, USD/JPY at 145, $50 risk, 40-pip stop", () => {
    const rates = { "USD/JPY": 145 };
    const units = positionSizeUnits({ riskAmount: 50, stopPips: 40, pairSymbol: "USD/JPY", accountCurrency: "USD", rates });
    // pip value per unit = 0.01/145 ≈ 0.000068965; 50/(40×0.000068965) ≈ 18,125
    expect(units).toBe(18125);
  });

  it("floors to whole units so risk never exceeds the budget", () => {
    const rates = { "EUR/USD": 1.0 };
    const units = positionSizeUnits({ riskAmount: 10, stopPips: 33, pairSymbol: "EUR/USD", accountCurrency: "USD", rates });
    expect(units).toBe(Math.floor(10 / (33 * 0.0001)));
  });

  it("returns null on unusable inputs", () => {
    const rates = { "EUR/USD": 1.085 };
    expect(positionSizeUnits({ riskAmount: 0, stopPips: 25, pairSymbol: "EUR/USD", accountCurrency: "USD", rates })).toBeNull();
    expect(positionSizeUnits({ riskAmount: 20, stopPips: 0, pairSymbol: "EUR/USD", accountCurrency: "USD", rates })).toBeNull();
    expect(positionSizeUnits({ riskAmount: 20, stopPips: 25, pairSymbol: "EUR/USD", accountCurrency: "CHF", rates })).toBeNull();
  });
});

describe("lot conversions", () => {
  it("converts units ↔ lots", () => {
    expect(unitsToLots(100000)).toBe(1);
    expect(unitsToLots(8000)).toBeCloseTo(0.08, 10);
    expect(lotsToUnits(0.08)).toBe(8000);
    expect(lotsToUnits(1.5)).toBe(150000);
  });

  it("breaks a unit count into every lot convention", () => {
    expect(lotBreakdown(10000)).toEqual({ standard: 0.1, mini: 1, micro: 10, nano: 100 });
  });

  it("describes units per the product phrasing", () => {
    expect(describeUnits(8000)).toBe("8,000 currency units, equal to 0.08 standard lots");
    expect(describeUnits(100000)).toBe("100,000 currency units, equal to 1 standard lot");
  });
});

describe("notional, margin, and leverage", () => {
  const rates = { "EUR/USD": 1.085 };

  it("notional in account currency (USD account, 8,000 EUR/USD ≈ $8,680)", () => {
    expect(notionalValue({ pairSymbol: "EUR/USD", units: 8000, rates, accountCurrency: "USD" })).toBeCloseTo(8680, 0);
  });

  it("margin = notional ÷ leverage (≈ $174 at 50:1)", () => {
    const notional = notionalValue({ pairSymbol: "EUR/USD", units: 8000, rates, accountCurrency: "USD" })!;
    expect(requiredMargin(notional, 50)).toBeCloseTo(173.6, 1);
    expect(requiredMargin(notional, 0)).toBeNull();
  });

  it("effective leverage = notional ÷ equity", () => {
    expect(effectiveLeverage(25000, 1000)).toBe(25);
    expect(effectiveLeverage(8680, 2000)).toBeCloseTo(4.34, 2);
    expect(effectiveLeverage(1000, 0)).toBeNull();
  });

  it("free margin and leverage formatting", () => {
    expect(freeMargin(2000, 173.6)).toBeCloseTo(1826.4, 6);
    expect(formatLeverage(50)).toBe("50:1");
    expect(formatLeverage(7.43)).toBe("7.4:1");
  });
});
