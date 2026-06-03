import { describe, it, expect } from "vitest";
import { DEMO_HOLDINGS, DEMO_TOTAL_VALUE, demoPortfolioInput } from "./demo.js";
import { scorePortfolio, MIN_HOLDINGS_FOR_ANALYSIS } from "./portfolio.js";

describe("demo portfolio", () => {
  it("has enough priced holdings to be analyzable (never 'insufficient')", () => {
    expect(DEMO_HOLDINGS.length).toBeGreaterThanOrEqual(MIN_HOLDINGS_FOR_ANALYSIS);
    const result = scorePortfolio(demoPortfolioInput());
    expect(result.status).toBe("scored");
  });

  it("scores tech-concentrated so Reviews/Intelligence surface a real flag", () => {
    const result = scorePortfolio(demoPortfolioInput());
    if (result.status !== "scored") throw new Error("expected scored");
    const tech = result.sectorConcentration.find((s) => s.sector === "Technology");
    expect(tech).toBeDefined();
    // AAPL+MSFT+NVDA = 50k of 98k invested ≈ 51% → above the 35% concentration flag.
    expect(tech!.pct).toBeGreaterThanOrEqual(35);
    expect(result.weaknesses.length).toBeGreaterThan(0);
  });

  it("total value equals invested + cash", () => {
    const invested = DEMO_HOLDINGS.reduce((a, h) => a + h.marketValue, 0);
    const result = scorePortfolio(demoPortfolioInput());
    if (result.status !== "scored") throw new Error("expected scored");
    expect(DEMO_TOTAL_VALUE).toBe(invested + result.cash);
    expect(result.totalValue).toBe(DEMO_TOTAL_VALUE);
  });
});
