import { describe, it, expect } from "vitest";
import {
  pipSizeFor,
  pipetteSizeFor,
  priceDecimalsFor,
  priceDiffToPips,
  pipsToPriceDiff,
  splitPair,
  normalizePair,
  formatPairPrice,
} from "./pips.js";
import { getRate, convertAmount } from "./conversion.js";

describe("pip size detection", () => {
  it("uses 0.0001 for non-JPY quote pairs", () => {
    expect(pipSizeFor("EUR/USD")).toBe(0.0001);
    expect(pipSizeFor("GBP/USD")).toBe(0.0001);
    expect(pipSizeFor("EUR/GBP")).toBe(0.0001);
    expect(pipSizeFor("USD/CHF")).toBe(0.0001);
  });

  it("uses 0.01 for JPY-quoted pairs (but not JPY-base pairs)", () => {
    expect(pipSizeFor("USD/JPY")).toBe(0.01);
    expect(pipSizeFor("EUR/JPY")).toBe(0.01);
    expect(pipSizeFor("GBP/JPY")).toBe(0.01);
    // JPY as BASE would still quote in the other currency's convention
    expect(pipSizeFor("JPY/USD")).toBe(0.0001);
  });

  it("accepts flat symbols and exposes pipettes and decimals", () => {
    expect(pipSizeFor("EURUSD")).toBe(0.0001);
    expect(pipetteSizeFor("EUR/USD")).toBeCloseTo(0.00001, 10);
    expect(pipetteSizeFor("USD/JPY")).toBeCloseTo(0.001, 10);
    expect(priceDecimalsFor("EUR/USD")).toBe(5);
    expect(priceDecimalsFor("USD/JPY")).toBe(3);
  });
});

describe("pair parsing", () => {
  it("splits slash and flat forms", () => {
    expect(splitPair("EUR/USD")).toEqual({ base: "EUR", quote: "USD" });
    expect(splitPair("eurusd")).toEqual({ base: "EUR", quote: "USD" });
    expect(splitPair("nonsense")).toBeNull();
    expect(normalizePair("gbpjpy")).toBe("GBP/JPY");
    expect(normalizePair("x")).toBeNull();
  });
});

describe("price/pip conversion", () => {
  it("converts price distances to pips and back", () => {
    expect(priceDiffToPips(0.0025, 0.0001)).toBeCloseTo(25, 6);
    expect(priceDiffToPips(-0.0025, 0.0001)).toBeCloseTo(25, 6);
    expect(priceDiffToPips(0.5, 0.01)).toBeCloseTo(50, 6);
    expect(pipsToPriceDiff(25, 0.0001)).toBeCloseTo(0.0025, 10);
    expect(pipsToPriceDiff(50, 0.01)).toBeCloseTo(0.5, 10);
  });

  it("formats prices at pair precision", () => {
    expect(formatPairPrice(1.085, "EUR/USD")).toBe("1.08500");
    expect(formatPairPrice(145.25, "USD/JPY")).toBe("145.250");
  });
});

describe("currency conversion (direct / inverse / cross)", () => {
  const rates = { "EUR/USD": 1.085, "USD/JPY": 145.0, "GBP/USD": 1.27 };

  it("identity and direct", () => {
    expect(getRate("USD", "USD", rates)).toBe(1);
    expect(getRate("EUR", "USD", rates)).toBe(1.085);
  });

  it("inverse", () => {
    expect(getRate("USD", "EUR", rates)).toBeCloseTo(1 / 1.085, 10);
    expect(getRate("JPY", "USD", rates)).toBeCloseTo(1 / 145, 10);
  });

  it("cross via USD legs", () => {
    // EUR → JPY = EUR/USD × USD/JPY
    expect(getRate("EUR", "JPY", rates)).toBeCloseTo(1.085 * 145, 6);
    // GBP → EUR = GBP/USD × 1/(EUR/USD)
    expect(getRate("GBP", "EUR", rates)).toBeCloseTo(1.27 / 1.085, 10);
  });

  it("returns null when no path exists and converts amounts", () => {
    expect(getRate("AUD", "CHF", rates)).toBeNull();
    expect(convertAmount({ from: "EUR", to: "USD", amount: 100, rates })).toBeCloseTo(108.5, 6);
    expect(convertAmount({ from: "AUD", to: "CHF", amount: 100, rates })).toBeNull();
  });
});
