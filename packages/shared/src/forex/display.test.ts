import { describe, it, expect } from "vitest";
import { groupByLocalDay, atrMoneyForUnits } from "./display.js";

describe("groupByLocalDay", () => {
  // Fixed clock: Wed 2026-07-15 12:00 UTC, grouping in UTC for determinism.
  const now = new Date("2026-07-15T12:00:00Z");
  const tz = "UTC";
  const ev = (iso: string, name: string) => ({ eventTime: iso, name });

  it("labels today/tomorrow/weekday and sorts chronologically", () => {
    const groups = groupByLocalDay(
      [
        ev("2026-07-17T08:00:00Z", "fri-late"),
        ev("2026-07-15T18:00:00Z", "today-pm"),
        ev("2026-07-15T06:00:00Z", "today-am"),
        ev("2026-07-16T09:00:00Z", "tomorrow"),
      ],
      (e) => e.eventTime,
      { now, timeZone: tz },
    );
    expect(groups.map((g) => g.label)).toEqual([
      "Today — July 15",
      "Tomorrow — July 16",
      "Friday — July 17",
    ]);
    expect(groups[0]!.items.map((e) => e.name)).toEqual(["today-am", "today-pm"]);
  });

  it("groups by the viewer's timezone day, not UTC", () => {
    // 2026-07-16T01:00Z is still July 15 in New York (UTC-4).
    const groups = groupByLocalDay([ev("2026-07-16T01:00:00Z", "late-ny")], (e) => e.eventTime, {
      now,
      timeZone: "America/New_York",
    });
    expect(groups[0]!.label).toBe("Today — July 15");
  });

  it("omits empty days entirely", () => {
    const groups = groupByLocalDay(
      [ev("2026-07-15T06:00:00Z", "a"), ev("2026-07-18T06:00:00Z", "b")],
      (e) => e.eventTime,
      { now, timeZone: tz },
    );
    expect(groups).toHaveLength(2); // no empty 16th/17th groups
  });
});

describe("atrMoneyForUnits", () => {
  it("spec example: ~44 pips on EUR/USD ≈ $4.40 per 1,000 units (USD account)", () => {
    const r = atrMoneyForUnits({
      pairSymbol: "EUR/USD",
      atrPips: 44,
      units: 1000,
      accountCurrency: "USD",
      rates: { "EUR/USD": 1.14 },
    })!;
    expect(r.converted).toBe(true);
    expect(r.currency).toBe("USD");
    expect(r.amount).toBeCloseTo(4.4, 2);
  });

  it("converts JPY-quote movement into the account currency", () => {
    // 120 pips × 0.01 × 1000 = 1,200 JPY → USD at 1/145 ≈ $8.28
    const r = atrMoneyForUnits({
      pairSymbol: "USD/JPY",
      atrPips: 120,
      units: 1000,
      accountCurrency: "USD",
      rates: { "USD/JPY": 145 },
    })!;
    expect(r.converted).toBe(true);
    expect(r.amount).toBeCloseTo(1200 / 145, 2);
  });

  it("falls back to the quote currency when no conversion path exists", () => {
    const r = atrMoneyForUnits({
      pairSymbol: "EUR/GBP",
      atrPips: 30,
      units: 1000,
      accountCurrency: "USD",
      rates: {}, // no rates at all
    })!;
    expect(r.converted).toBe(false);
    expect(r.currency).toBe("GBP");
    expect(r.amount).toBeCloseTo(3, 6);
  });

  it("returns null on unusable inputs", () => {
    expect(
      atrMoneyForUnits({ pairSymbol: "nope", atrPips: 44, units: 1000, accountCurrency: "USD", rates: {} }),
    ).toBeNull();
    expect(
      atrMoneyForUnits({ pairSymbol: "EUR/USD", atrPips: 0, units: 1000, accountCurrency: "USD", rates: {} }),
    ).toBeNull();
  });
});
