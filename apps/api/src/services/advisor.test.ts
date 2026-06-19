import { describe, it, expect } from "vitest";
import { enforceNonAdvisory } from "./advisor.js";

describe("enforceNonAdvisory (AI Advisor guardrail)", () => {
  it("passes through a clean, educational answer unchanged", () => {
    const ok =
      "The P/E ratio compares a stock's price to its earnings per share. A higher P/E can mean investors expect growth, or that the stock is expensive — it's most useful versus peers.";
    expect(enforceNonAdvisory(ok)).toBe(ok);
  });

  it("replaces any buy/sell directive or guarantee with the non-advisory fallback", () => {
    const bad = [
      "You should buy NVDA now.",
      "I recommend buying this stock.",
      "Sell now before it drops.",
      "This is guaranteed to rise.",
      "It will definitely go up.",
    ];
    for (const text of bad) {
      const out = enforceNonAdvisory(text);
      expect(out).not.toBe(text);
      expect(out.toLowerCase()).toContain("educational");
    }
  });

  it("replaces an empty answer with the fallback", () => {
    expect(enforceNonAdvisory("")).not.toBe("");
    expect(enforceNonAdvisory("").toLowerCase()).toContain("educational");
  });
});
