import { describe, it, expect } from "vitest";
import {
  potentialProfit,
  riskRewardRatio,
  formatRiskReward,
  breakEvenWinRatePct,
  tradeCosts,
  netReward,
} from "./trade.js";
import { evaluateRiskStatus, ELEVATED_EFFECTIVE_LEVERAGE } from "./status.js";

describe("reward math", () => {
  it("potential profit = pip value × take-profit pips", () => {
    expect(potentialProfit(0.8, 50)).toBeCloseTo(40, 6);
    expect(potentialProfit(0.8, 0)).toBe(0);
  });

  it("risk-to-reward ratio and 1:X formatting", () => {
    expect(riskRewardRatio(20, 40)).toBe(2);
    expect(formatRiskReward(2)).toBe("1:2");
    expect(formatRiskReward(2.14)).toBe("1:2.1");
    expect(formatRiskReward(3.0)).toBe("1:3");
    expect(riskRewardRatio(0, 40)).toBeNull();
  });

  it("break-even win rate matches the reference table", () => {
    expect(breakEvenWinRatePct(1, 1)).toBeCloseTo(50, 3); // 1:1
    expect(breakEvenWinRatePct(1, 1.5)).toBeCloseTo(40, 3); // 1:1.5
    expect(breakEvenWinRatePct(1, 2)).toBeCloseTo(33.3, 1); // 1:2
    expect(breakEvenWinRatePct(1, 3)).toBeCloseTo(25, 3); // 1:3
  });
});

describe("trade costs", () => {
  it("prices spread from pips × pip value, keeps missing costs null", () => {
    const c = tradeCosts({ spreadPips: 1.5, pipValueAccount: 0.8, commission: null, swap: null });
    expect(c.spreadCost).toBeCloseTo(1.2, 6);
    expect(c.commission).toBeNull();
    expect(c.swap).toBeNull();
    expect(c.total).toBeCloseTo(1.2, 6);
  });

  it("sums entered costs and nets them from the reward", () => {
    const c = tradeCosts({ spreadPips: 2, pipValueAccount: 1, commission: 5, swap: 1.5 });
    expect(c.total).toBeCloseTo(8.5, 6);
    expect(netReward(40, c)).toBeCloseTo(31.5, 6);
  });
});

describe("risk status evaluation", () => {
  const base = {
    missingInputs: [] as string[],
    actualRiskPct: 1,
    defaultRiskPct: 1,
    maxRiskPct: 2,
    actualRiskAmount: 20,
    accountBalance: 2000,
    stopDefined: true,
    positionValid: true,
    requiredMargin: 174,
    effectiveLeverage: 4.3,
    rewardRatio: 2,
    preferredRewardRatio: 1.5,
  };

  it("WITHIN_PLAN when everything fits the user's settings", () => {
    const r = evaluateRiskStatus(base);
    expect(r.status).toBe("WITHIN_PLAN");
    expect(r.label).toBe("Within Plan");
    expect(r.reasons.length).toBeGreaterThan(0);
    // the word "safe" is banned from product language
    expect(r.reasons.join(" ").toLowerCase()).not.toContain("safe");
  });

  it("MISSING_INFO short-circuits when inputs are incomplete", () => {
    const r = evaluateRiskStatus({ ...base, missingInputs: ["a stop-loss price or pip distance"] });
    expect(r.status).toBe("MISSING_INFO");
    expect(r.reasons[0]).toMatch(/Missing/);
  });

  it("CAUTION between default and max risk, on elevated leverage, low reward ratio, or an event", () => {
    expect(evaluateRiskStatus({ ...base, actualRiskPct: 1.5 }).status).toBe("CAUTION");
    expect(evaluateRiskStatus({ ...base, effectiveLeverage: ELEVATED_EFFECTIVE_LEVERAGE }).status).toBe("CAUTION");
    expect(evaluateRiskStatus({ ...base, rewardRatio: 1 }).status).toBe("CAUTION");
    expect(evaluateRiskStatus({ ...base, highImpactEventSoon: true }).status).toBe("CAUTION");
  });

  it("the event hard rule escalates an approaching event to OUTSIDE_PLAN", () => {
    const r = evaluateRiskStatus({ ...base, highImpactEventSoon: true, eventBlockEnabled: true });
    expect(r.status).toBe("OUTSIDE_PLAN");
    expect(r.reasons.some((x) => x.includes("outside plan"))).toBe(true);
    // without an event, the rule changes nothing
    expect(evaluateRiskStatus({ ...base, eventBlockEnabled: true }).status).toBe("WITHIN_PLAN");
  });

  it("OUTSIDE_PLAN when risk exceeds the max, margin exceeds balance, risk exceeds balance, no stop, or invalid size", () => {
    expect(evaluateRiskStatus({ ...base, actualRiskPct: 2.5 }).status).toBe("OUTSIDE_PLAN");
    expect(evaluateRiskStatus({ ...base, requiredMargin: 2500 }).status).toBe("OUTSIDE_PLAN");
    expect(evaluateRiskStatus({ ...base, actualRiskAmount: 2500 }).status).toBe("OUTSIDE_PLAN");
    expect(evaluateRiskStatus({ ...base, stopDefined: false }).status).toBe("OUTSIDE_PLAN");
    expect(evaluateRiskStatus({ ...base, positionValid: false }).status).toBe("OUTSIDE_PLAN");
  });

  it("OUTSIDE_PLAN outranks CAUTION and keeps all reasons", () => {
    const r = evaluateRiskStatus({ ...base, actualRiskPct: 2.5, effectiveLeverage: 30 });
    expect(r.status).toBe("OUTSIDE_PLAN");
    expect(r.reasons.some((x) => x.includes("maximum limit"))).toBe(true);
    expect(r.reasons.some((x) => x.includes("Effective leverage"))).toBe(true);
  });
});
