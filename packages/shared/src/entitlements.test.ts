import { describe, it, expect } from "vitest";
import { entitlementsFor, withinAiQuota } from "./entitlements.js";

describe("entitlements", () => {
  it("Free plan allows exactly 1 watchlist and 1 connected account", () => {
    const e = entitlementsFor("FREE");
    expect(e.maxWatchlists).toBe(1);
    expect(e.maxConnectedAccounts).toBe(1);
    expect(e.portfolioIntelligence).toBe(false);
  });

  it("Investor plan unlocks intelligence and unlimited watchlists", () => {
    const e = entitlementsFor("INVESTOR");
    expect(e.maxWatchlists).toBe(Number.POSITIVE_INFINITY);
    expect(e.portfolioIntelligence).toBe(true);
    expect(e.newsIntelligence).toBe(true);
  });

  it("Investor Plus has unlimited AI analyses", () => {
    expect(entitlementsFor("INVESTOR_PLUS").aiAnalysesPerPeriod).toBeNull();
  });

  it("withinAiQuota enforces the Free limit and allows unlimited plans", () => {
    expect(withinAiQuota("FREE", 9)).toBe(true);
    expect(withinAiQuota("FREE", 10)).toBe(false); // limit is 10
    expect(withinAiQuota("INVESTOR_PLUS", 9999)).toBe(true);
  });
});
