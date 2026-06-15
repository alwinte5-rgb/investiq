import { describe, it, expect } from "vitest";
import { applyFmpAnalyst, applyFmpRatios, parseFmpProfile, parseFmpScreener } from "./fundamentals.js";
import { parsePolygonIndicatorLatest } from "./market-data.js";

describe("parseFmpProfile", () => {
  it("maps an FMP profile array row to normalized fundamentals", () => {
    const raw = [
      { symbol: "AAPL", price: 190.1, beta: 1.2, marketCap: 3_000_000_000_000, sector: "Technology", industry: "Consumer Electronics" },
    ];
    const f = parseFmpProfile("aapl", raw);
    expect(f.ticker).toBe("AAPL");
    expect(f.price).toBe(190.1);
    expect(f.beta).toBe(1.2);
    expect(f.marketCap).toBe(3_000_000_000_000);
    expect(f.sector).toBe("Technology");
    expect(f.source).toBe("fmp");
  });

  it("coerces missing/invalid numeric fields to null", () => {
    const f = parseFmpProfile("XYZ", [{ symbol: "XYZ", sector: "" }]);
    expect(f.marketCap).toBeNull();
    expect(f.beta).toBeNull();
    expect(f.price).toBeNull();
    expect(f.sector).toBeNull(); // empty string → null
  });

  it("handles an empty response", () => {
    const f = parseFmpProfile("XYZ", []);
    expect(f.ticker).toBe("XYZ");
    expect(f.marketCap).toBeNull();
  });
});

describe("applyFmpRatios", () => {
  const base = parseFmpProfile("AAPL", [{ marketCap: 1 }]);

  it("merges TTM valuation/quality ratios, tolerating field-name variants", () => {
    const merged = applyFmpRatios(base, [
      {
        priceToEarningsRatioTTM: 28.5,
        priceToSalesRatioTTM: 7.1,
        pbRatioTTM: 45,
        returnOnEquityTTM: 1.5,
        debtToEquityRatioTTM: 1.8,
        netProfitMarginTTM: 0.25,
      },
    ]);
    expect(merged.pe).toBe(28.5);
    expect(merged.ps).toBe(7.1);
    expect(merged.pb).toBe(45);
    expect(merged.roe).toBe(1.5);
    expect(merged.debtToEquity).toBe(1.8);
    expect(merged.netMargin).toBe(0.25);
  });

  it("leaves ratios null on an empty payload", () => {
    const merged = applyFmpRatios(base, []);
    expect(merged.ps).toBeNull();
    expect(merged.roe).toBeNull();
  });
});

describe("applyFmpAnalyst", () => {
  const base = parseFmpProfile("AAPL", [{ marketCap: 1 }]);

  it("merges price target and rating consensus", () => {
    const merged = applyFmpAnalyst(
      base,
      [{ lastQuarterAvgPriceTarget: 240 }],
      [{ consensus: "Buy" }],
    );
    expect(merged.priceTargetAvg).toBe(240);
    expect(merged.analystConsensus).toBe("Buy");
  });

  it("stays null when analyst data is absent", () => {
    const merged = applyFmpAnalyst(base, null, null);
    expect(merged.priceTargetAvg).toBeNull();
    expect(merged.analystConsensus).toBeNull();
  });
});

describe("parseFmpScreener", () => {
  it("maps screener rows to candidates and flags ETFs", () => {
    const rows = parseFmpScreener([
      { symbol: "nvda", companyName: "NVIDIA", sector: "Technology", marketCap: 3e12, price: 120, beta: 1.7, isEtf: false },
      { symbol: "SPY", companyName: "SPDR S&P 500", marketCap: 5e11, price: 540, isEtf: true },
      { companyName: "no symbol — dropped" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ ticker: "NVDA", assetType: "STOCK", price: 120 });
    expect(rows[1]).toMatchObject({ ticker: "SPY", assetType: "ETF" });
  });

  it("returns [] for a non-array payload", () => {
    expect(parseFmpScreener({ error: "x" })).toEqual([]);
  });
});

describe("parsePolygonIndicatorLatest", () => {
  it("extracts the latest value and MACD signal", () => {
    expect(parsePolygonIndicatorLatest({ results: { values: [{ value: 61.2 }] } })).toEqual({
      value: 61.2,
      signal: null,
    });
    expect(
      parsePolygonIndicatorLatest({ results: { values: [{ value: 1.1, signal: 0.9 }] } }),
    ).toEqual({ value: 1.1, signal: 0.9 });
  });

  it("returns nulls for an empty indicator response", () => {
    expect(parsePolygonIndicatorLatest({})).toEqual({ value: null, signal: null });
  });
});
