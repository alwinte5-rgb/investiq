import { describe, it, expect } from "vitest";
import { assessRisk, riskWarnings, volatilityFromBeta, DEFAULT_VOLATILITY_PCT, TARGET_RR } from "./risk.js";

describe("assessRisk", () => {
  it("returns insufficient with no usable price", () => {
    expect(assessRisk({ price: 0, volatilityPct: 4 }).status).toBe("insufficient");
    expect(assessRisk({ price: -5, volatilityPct: 4 }).status).toBe("insufficient");
  });

  it("computes levels and a 2:1 reward:risk from price + volatility", () => {
    const r = assessRisk({ price: 100, volatilityPct: 4 });
    if (r.status !== "assessed") throw new Error("expected assessed");
    // unit = 4; stop = 100 - 1.5*4 = 94; risk = 6; target = 100 + 2*6 = 112
    expect(r.stopLoss).toBe(94);
    expect(r.profitTarget).toBe(112);
    expect(r.riskReward).toBe(TARGET_RR);
    expect(r.buyZoneLow).toBe(99);
    expect(r.buyZoneHigh).toBe(101);
    expect(r.warningColor).toBe("GREEN");
    expect(r.warnings).toHaveLength(0);
  });

  it("sizes the position from account value and per-trade risk", () => {
    const r = assessRisk({ price: 100, volatilityPct: 4, accountValue: 10000, riskPerTradePct: 1 });
    if (r.status !== "assessed") throw new Error("expected assessed");
    // maxRisk = 1% of 10000 = $100; riskPerShare = 6 → floor(100/6) = 16
    expect(r.maxRiskAmount).toBe(100);
    expect(r.positionSize).toBe(16);
  });

  it("leaves position size null without an account value", () => {
    const r = assessRisk({ price: 50, volatilityPct: 4 });
    if (r.status !== "assessed") throw new Error("expected assessed");
    expect(r.positionSize).toBeNull();
    expect(r.maxRiskAmount).toBeNull();
  });

  it("escalates the warning color as risks stack (earnings + concentration + negative news → RED)", () => {
    const r = assessRisk({
      price: 100,
      volatilityPct: 4,
      earningsInDays: 3,
      heldWeightPct: 40,
      newsSentiment: "NEGATIVE",
    });
    if (r.status !== "assessed") throw new Error("expected assessed");
    expect(r.warnings.filter((w) => w.severity === "warn").length).toBeGreaterThanOrEqual(3);
    expect(r.warningColor).toBe("RED");
  });

  it("flags elevated volatility on a high-beta name", () => {
    const r = assessRisk({ price: 100, volatilityPct: 8 });
    if (r.status !== "assessed") throw new Error("expected assessed");
    expect(r.warnings.some((w) => w.type === "volatility")).toBe(true);
    expect(r.warningColor).toBe("YELLOW");
  });

  it("positive news is informational, not a serious warning (stays GREEN)", () => {
    const r = assessRisk({ price: 100, volatilityPct: 4, newsSentiment: "POSITIVE" });
    if (r.status !== "assessed") throw new Error("expected assessed");
    expect(r.warningColor).toBe("GREEN");
    expect(r.warnings.some((w) => w.type === "news" && w.severity === "info")).toBe(true);
  });
});

describe("riskWarnings (portfolio path — no price/levels)", () => {
  it("a calm, well-sized holding is GREEN with no warnings", () => {
    const r = riskWarnings({ heldWeightPct: 10, earningsInDays: null, newsSentiment: "NEUTRAL" });
    expect(r.warningColor).toBe("GREEN");
    expect(r.warnings).toHaveLength(0);
  });

  it("concentration alone → YELLOW", () => {
    const r = riskWarnings({ heldWeightPct: 30 });
    expect(r.warnings.some((w) => w.type === "concentration")).toBe(true);
    expect(r.warningColor).toBe("YELLOW");
  });

  it("concentration + imminent earnings + negative news → RED", () => {
    const r = riskWarnings({ heldWeightPct: 40, earningsInDays: 2, newsSentiment: "NEGATIVE" });
    expect(r.warningColor).toBe("RED");
  });
});

describe("volatilityFromBeta", () => {
  it("falls back to the market default when beta is missing", () => {
    expect(volatilityFromBeta(null)).toBe(DEFAULT_VOLATILITY_PCT);
    expect(volatilityFromBeta(0)).toBe(DEFAULT_VOLATILITY_PCT);
  });
  it("scales with beta and clamps to a sane band", () => {
    expect(volatilityFromBeta(1)).toBe(4);
    expect(volatilityFromBeta(2)).toBe(8);
    expect(volatilityFromBeta(10)).toBe(15); // clamped
  });
});
