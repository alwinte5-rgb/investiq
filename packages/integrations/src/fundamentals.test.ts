import { describe, it, expect } from "vitest";
import { parseFmpProfile } from "./fundamentals.js";

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
