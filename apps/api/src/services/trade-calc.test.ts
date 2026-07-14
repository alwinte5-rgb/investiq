import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration test for the complete trade-calculation workflow: user settings
 * (mocked persistence) -> live/manual rate merge -> shared calc engine ->
 * status + event awareness. Uses the product's reference case.
 */

const settingsRow = {
  accountCurrency: "USD",
  defaultAccountBalance: 2000,
  defaultRiskPercentage: 1,
  maximumRiskPercentage: 2,
  defaultLeverage: 50,
  preferredRewardRatio: 2,
  preferredLotDisplay: "UNITS",
  timezone: "UTC",
  eventWarningMinutes: 60,
  beginnerMode: true,
  experienceLevel: null,
  updatedAt: new Date("2026-07-13T00:00:00Z"),
};

vi.mock("@investiq/db", () => ({
  prisma: {
    userForexSettings: {
      upsert: vi.fn(async () => settingsRow),
      update: vi.fn(async () => settingsRow),
      findUnique: vi.fn(async () => settingsRow),
    },
  },
}));

import { calculateTrade } from "./trade-calc.js";
import type { ExchangeRateService } from "./exchange-rates.js";
import type { CalendarService } from "./calendar.js";

const noRates: ExchangeRateService = {
  enabled: false,
  getRates: async () => ({ rates: {}, lastUpdated: null, stale: true, provider: "none" }),
};

const quietCalendar: CalendarService = {
  providerEnabled: false,
  listEvents: async () => ({ events: [], providerEnabled: false }),
  upcomingHighImpact: async () => [],
};

const REFERENCE = {
  accountBalance: 2000,
  accountCurrency: "USD" as const,
  pairSymbol: "EUR/USD",
  direction: "BUY" as const,
  entryPrice: 1.085,
  stopLossPips: 25,
  riskPercentage: 1,
  leverage: 50,
};

describe("calculateTrade (workflow integration)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reference case flows settings -> engine -> status", async () => {
    const r = await calculateTrade("user_1", REFERENCE, { rates: noRates, calendar: quietCalendar });
    expect(r.maxSelectedRiskAmount).toBe(20);
    expect(r.recommendedUnits).toBe(8000);
    expect(r.lots).toBeCloseTo(0.08, 6);
    expect(r.pipValue).toBeCloseTo(0.8, 2);
    expect(r.requiredMargin).toBeCloseTo(173.6, 1);
    expect(r.status.status).toBe("WITHIN_PLAN");
    expect(r.settings).toEqual({ defaultRiskPct: 1, maxRiskPct: 2, preferredRewardRatio: 2 });
    expect(r.summary).toContain("not your maximum loss");
  });

  it("risk above the user's max limit comes back OUTSIDE_PLAN", async () => {
    const r = await calculateTrade(
      "user_1",
      { ...REFERENCE, riskPercentage: 5 },
      { rates: noRates, calendar: quietCalendar },
    );
    expect(r.status.status).toBe("OUTSIDE_PLAN");
    expect(r.status.reasons.some((x) => x.includes("maximum limit"))).toBe(true);
  });

  it("an approaching high-impact event raises Caution and a warning", async () => {
    const eventCalendar: CalendarService = {
      ...quietCalendar,
      upcomingHighImpact: async () => [
        { name: "US CPI", currency: "USD", eventTime: new Date(Date.now() + 22 * 60_000) },
      ],
    };
    const r = await calculateTrade("user_1", REFERENCE, { rates: noRates, calendar: eventCalendar });
    expect(r.status.status).toBe("CAUTION");
    expect(r.warnings.some((w) => w.includes("US CPI"))).toBe(true);
  });

  it("client-supplied manual rates win over provider rates", async () => {
    const liveRates: ExchangeRateService = {
      enabled: true,
      getRates: async () => ({
        rates: { "EUR/USD": 2.0 },
        lastUpdated: new Date().toISOString(),
        stale: false,
        provider: "test",
      }),
    };
    const r = await calculateTrade(
      "user_1",
      { ...REFERENCE, rates: { "EUR/USD": 1.085 } },
      { rates: liveRates, calendar: quietCalendar },
    );
    // Notional uses the manual 1.085, not the provider's 2.0.
    expect(r.notionalValue).toBeCloseTo(8680, 0);
  });

  it("cross-currency account works when a conversion rate is supplied", async () => {
    const r = await calculateTrade(
      "user_1",
      { ...REFERENCE, accountCurrency: "GBP", rates: { "GBP/USD": 1.27 } },
      { rates: noRates, calendar: quietCalendar },
    );
    expect(r.status.status).not.toBe("MISSING_INFO");
    expect(r.recommendedUnits).toBeGreaterThan(0);
  });
});
