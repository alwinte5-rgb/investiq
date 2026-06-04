import { describe, it, expect } from "vitest";
import {
  scorePortfolio,
  INSUFFICIENT_HOLDINGS_MESSAGE,
  type PortfolioInput,
  type HoldingInput,
} from "./portfolio.js";

const h = (ticker: string, sector: string | null, marketValue: number, assetType: "STOCK" | "ETF" = "STOCK"): HoldingInput => ({
  ticker,
  sector,
  marketValue,
  assetType,
});

const balanced: PortfolioInput = {
  cash: 1000,
  holdings: [
    h("AAPL", "Technology", 2500),
    h("JPM", "Financials", 2500),
    h("XOM", "Energy", 2500),
    h("JNJ", "Healthcare", 2500),
    h("VTI", "Diversified", 2500, "ETF"),
  ],
};

describe("scorePortfolio — sufficiency", () => {
  it("returns insufficient only when there are no priced holdings", () => {
    const res = scorePortfolio({ cash: 0, holdings: [] });
    expect(res.status).toBe("insufficient");
    if (res.status === "insufficient") {
      expect(res.message).toBe(INSUFFICIENT_HOLDINGS_MESSAGE);
      expect(res.holdingsCount).toBe(0);
    }
  });

  it("scores a thin portfolio (no roadblock) — honestly undiversified, not fabricated", () => {
    const res = scorePortfolio({ cash: 0, holdings: [h("AAPL", "Technology", 100), h("MSFT", "Technology", 100)] });
    expect(res.status).toBe("scored");
    if (res.status === "scored") {
      expect(res.holdingsCount).toBe(2);
      // two single-sector names → genuinely low diversification (honest, not a wall)
      expect(res.diversificationScore).toBeLessThan(50);
    }
  });

  it("ignores zero-value holdings when counting (all zero-value → insufficient)", () => {
    const res = scorePortfolio({ cash: 0, holdings: [h("A", "Tech", 0), h("B", "Energy", 0)] });
    expect(res.status).toBe("insufficient"); // no priced holdings
  });
});

describe("scorePortfolio — scoring", () => {
  it("scores a balanced portfolio with all metrics in range", () => {
    const res = scorePortfolio(balanced);
    expect(res.status).toBe("scored");
    if (res.status !== "scored") return;
    for (const s of [res.healthScore, res.riskScore, res.diversificationScore, res.cashScore]) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
    expect(res.invested).toBe(12500);
    expect(res.totalValue).toBe(13500);
    expect(res.sectorConcentration.map((s) => s.sector)).toContain("Technology");
    // sector weights sum to ~100
    const sum = res.sectorConcentration.reduce((a, s) => a + s.pct, 0);
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(1);
  });

  it("flags concentration: a dominant single position lowers health & raises risk", () => {
    const concentrated = scorePortfolio({
      cash: 0,
      holdings: [h("AAPL", "Technology", 9000), h("MSFT", "Technology", 600), h("NVDA", "Technology", 400)],
    });
    const diversified = scorePortfolio(balanced);
    if (concentrated.status !== "scored" || diversified.status !== "scored") throw new Error("scored");

    expect(concentrated.riskScore).toBeGreaterThan(diversified.riskScore);
    expect(concentrated.healthScore).toBeLessThan(diversified.healthScore);
    expect(concentrated.overweight.some((s) => s.sector === "Technology")).toBe(true);
    expect(concentrated.weaknesses.join(" ")).toMatch(/AAPL/);
  });

  it("is reproducible — same inputs and holding order produce identical output", () => {
    expect(scorePortfolio(balanced)).toEqual(scorePortfolio(balanced));
  });

  it("is order-independent on the sector breakdown", () => {
    const reversed: PortfolioInput = { cash: balanced.cash, holdings: [...balanced.holdings].reverse() };
    const a = scorePortfolio(balanced);
    const b = scorePortfolio(reversed);
    if (a.status !== "scored" || b.status !== "scored") throw new Error("scored");
    expect(a.sectorConcentration).toEqual(b.sectorConcentration);
    expect(a.healthScore).toBe(b.healthScore);
  });

  it("penalizes very high cash (drag) in the cash score and improvements", () => {
    const cashy = scorePortfolio({ cash: 50000, holdings: balanced.holdings });
    if (cashy.status !== "scored") throw new Error("scored");
    expect(cashy.cashScore).toBeLessThan(60);
    expect(cashy.improvements.join(" ")).toMatch(/idle cash|cash drag/i);
  });
});
