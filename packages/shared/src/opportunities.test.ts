import { describe, expect, it } from "vitest";
import {
  buildOpportunities,
  categorizeOpportunity,
  type OpportunityInput,
} from "./opportunities.js";

const base: OpportunityInput = {
  ticker: "aapl",
  name: "Apple",
  assetType: "STOCK",
  recommendationType: "BUY_WATCH",
  confidenceScore: 70,
  riskScore: 40,
  held: false,
};

describe("categorizeOpportunity", () => {
  it("maps a stock buy-watch to BUY_WATCH and uppercases the ticker", () => {
    const o = categorizeOpportunity(base)!;
    expect(o.type).toBe("BUY_WATCH");
    expect(o.ticker).toBe("AAPL");
    expect(o.score).toBeGreaterThan(0);
    expect(o.supporting.recommendationType).toBe("BUY_WATCH");
  });

  it("routes an ETF buy-watch to the ETF bucket", () => {
    const o = categorizeOpportunity({ ...base, assetType: "ETF", recommendationType: "STRONG_BUY_WATCH" })!;
    expect(o.type).toBe("ETF");
  });

  it("treats a held HIGH_RISK_WARNING as a high-risk holding, unheld as avoid", () => {
    expect(categorizeOpportunity({ ...base, recommendationType: "HIGH_RISK_WARNING", held: true })!.type).toBe(
      "HIGH_RISK_HOLDING",
    );
    expect(categorizeOpportunity({ ...base, recommendationType: "HIGH_RISK_WARNING", held: false })!.type).toBe(
      "AVOID",
    );
  });

  it("only flags TRIM/EXIT for review when actually held", () => {
    expect(categorizeOpportunity({ ...base, recommendationType: "TRIM_POSITION", held: true })!.type).toBe("REVIEW");
    expect(categorizeOpportunity({ ...base, recommendationType: "TRIM_POSITION", held: false })).toBeNull();
  });

  it("drops a calm HOLD, but flags a held HOLD that has turned risky for review", () => {
    expect(categorizeOpportunity({ ...base, recommendationType: "HOLD" })).toBeNull();
    expect(
      categorizeOpportunity({ ...base, recommendationType: "HOLD", held: true, warningColor: "GREEN" }),
    ).toBeNull();
    expect(
      categorizeOpportunity({ ...base, recommendationType: "HOLD", held: true, warningColor: "RED" })!.type,
    ).toBe("REVIEW");
    // Risky but not held → still nothing to act on.
    expect(
      categorizeOpportunity({ ...base, recommendationType: "HOLD", held: false, warningColor: "RED" }),
    ).toBeNull();
  });

  it("scores higher confidence + lower risk above the reverse for buy-type", () => {
    const strong = categorizeOpportunity({ ...base, confidenceScore: 90, riskScore: 20 })!;
    const weak = categorizeOpportunity({ ...base, confidenceScore: 55, riskScore: 70 })!;
    expect(strong.score).toBeGreaterThan(weak.score);
  });
});

describe("buildOpportunities", () => {
  it("groups, ranks within a group, and omits empty groups", () => {
    const groups = buildOpportunities([
      { ...base, ticker: "MSFT", confidenceScore: 60, riskScore: 50 },
      { ...base, ticker: "NVDA", confidenceScore: 88, riskScore: 25 },
      { ...base, ticker: "HOLDCO", recommendationType: "HOLD" },
      { ...base, ticker: "RISK", recommendationType: "HIGH_RISK_WARNING", held: true },
    ]);
    const buy = groups.find((g) => g.type === "BUY_WATCH")!;
    expect(buy.items.map((o) => o.ticker)).toEqual(["NVDA", "MSFT"]); // ranked by score desc
    expect(groups.find((g) => g.type === "HIGH_RISK_HOLDING")?.items[0]?.ticker).toBe("RISK");
    // HOLD produced nothing, so no empty group is present.
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });
});
