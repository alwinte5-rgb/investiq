import { describe, expect, it } from "vitest";
import { buildChartOverlay, LEVEL_COLORS, type ChartEvent } from "./chart.js";

const risk = {
  buyZoneLow: 98,
  buyZoneHigh: 102,
  stopLoss: 94,
  profitTarget: 112,
  riskReward: 2,
  warningColor: "YELLOW" as const,
};

const analysis = {
  recommendationType: "BUY_WATCH",
  confidenceScore: 72,
  riskScore: 40,
  evidence: [
    { sourceType: "NEWS", role: "INVALIDATING" as const, note: "Lawsuit headline" },
    { sourceType: "PRICE", role: "SUPPORTING" as const, note: "Above 50dma" },
  ],
};

const events: ChartEvent[] = [
  { kind: "NEWS", date: "2026-06-01T00:00:00.000Z", label: "Beat earnings", tone: "POSITIVE" },
  { kind: "EARNINGS", date: "2026-05-01T00:00:00.000Z", label: "Q1 earnings" },
];

describe("buildChartOverlay", () => {
  it("derives price lines from stored risk levels, ordered high → low", () => {
    const o = buildChartOverlay({ ticker: "aapl", risk, analysis, events, now: new Date("2026-06-04") });
    expect(o.ticker).toBe("AAPL");
    expect(o.levels.map((l) => l.kind)).toEqual([
      "PROFIT_TARGET",
      "BUY_ZONE_HIGH",
      "BUY_ZONE_LOW",
      "STOP_LOSS",
    ]);
    expect(o.levels.map((l) => l.price)).toEqual([112, 102, 98, 94]);
    expect(o.levels.find((l) => l.kind === "PROFIT_TARGET")?.color).toBe(LEVEL_COLORS.PROFIT_TARGET);
    expect(o.hasRisk).toBe(true);
    expect(o.warningColor).toBe("YELLOW");
    expect(o.riskReward).toBe(2);
  });

  it("orders events oldest → newest", () => {
    const o = buildChartOverlay({ ticker: "AAPL", risk, analysis, events });
    expect(o.events.map((e) => e.label)).toEqual(["Q1 earnings", "Beat earnings"]);
  });

  it("orders Show Me Why with supporting evidence first", () => {
    const o = buildChartOverlay({ ticker: "AAPL", risk, analysis, events });
    expect(o.showMeWhy.map((e) => e.role)).toEqual(["SUPPORTING", "INVALIDATING"]);
    expect(o.recommendationType).toBe("BUY_WATCH");
    expect(o.hasAnalysis).toBe(true);
  });

  it("yields an empty, non-fabricated overlay when nothing is stored", () => {
    const o = buildChartOverlay({ ticker: "AAPL", risk: null, analysis: null, events: [] });
    expect(o.levels).toEqual([]);
    expect(o.showMeWhy).toEqual([]);
    expect(o.warningColor).toBeNull();
    expect(o.recommendationType).toBeNull();
    expect(o.hasRisk).toBe(false);
    expect(o.hasAnalysis).toBe(false);
  });

  it("keeps levels strictly high → low even if stored values are inverted", () => {
    const weird = { ...risk, stopLoss: 200, profitTarget: 50 };
    const o = buildChartOverlay({ ticker: "AAPL", risk: weird, analysis: null, events: [] });
    const prices = o.levels.map((l) => l.price);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });
});
