import { describe, it, expect } from "vitest";
import { financialStrengthScore, scoreLabel } from "./scoring.js";

describe("financialStrengthScore", () => {
  it("returns null when no inputs are available", () => {
    expect(financialStrengthScore({})).toBeNull();
    expect(financialStrengthScore({ roe: null, netMargin: null, debtToEquity: null })).toBeNull();
  });

  it("rewards high ROE + margin and penalizes leverage", () => {
    const strong = financialStrengthScore({ roe: 0.3, netMargin: 0.25, debtToEquity: 0.2 })!;
    const weak = financialStrengthScore({ roe: -0.05, netMargin: -0.1, debtToEquity: 2.5 })!;
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeGreaterThan(60);
    expect(weak).toBeLessThan(50);
  });

  it("clamps to 0–100 and works from a single input", () => {
    const v = financialStrengthScore({ roe: 5 })!; // absurdly high → clamps
    expect(v).toBe(100);
    expect(financialStrengthScore({ debtToEquity: 10 })!).toBe(0);
  });
});

describe("scoreLabel", () => {
  it("maps score bands to labels", () => {
    expect(scoreLabel(90)).toBe("Excellent");
    expect(scoreLabel(65)).toBe("Good");
    expect(scoreLabel(45)).toBe("Fair");
    expect(scoreLabel(20)).toBe("Weak");
  });
});
