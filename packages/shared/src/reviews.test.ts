import { describe, it, expect } from "vitest";
import {
  periodKeyFor,
  isoWeek,
  localMinutes,
  isWithinQuietHours,
  buildPortfolioReview,
  isValidTimeZone,
  type BuildReviewInput,
} from "./reviews.js";
import type { PortfolioScores } from "./portfolio.js";

describe("periodKeyFor", () => {
  it("uses the user's timezone for the local calendar date (MORNING)", () => {
    // 2026-06-02T03:30:00Z is still 2026-06-01 in New York (UTC-4 in June).
    const instant = new Date("2026-06-02T03:30:00Z");
    expect(periodKeyFor("MORNING", instant, "America/New_York")).toBe("2026-06-01");
    expect(periodKeyFor("MORNING", instant, "UTC")).toBe("2026-06-02");
  });

  it("formats MONTHLY as YYYY-MM in local time", () => {
    const instant = new Date("2026-06-01T02:00:00Z"); // still May 31 in NY
    expect(periodKeyFor("MONTHLY", instant, "America/New_York")).toBe("2026-05");
    expect(periodKeyFor("MONTHLY", instant, "UTC")).toBe("2026-06");
  });

  it("formats WEEKLY as ISO YYYY-Www", () => {
    // 2026-06-02 is a Tuesday → ISO week 23 of 2026.
    const instant = new Date("2026-06-02T15:00:00Z");
    expect(periodKeyFor("WEEKLY", instant, "UTC")).toBe("2026-W23");
  });

  it("falls back to UTC for an invalid timezone instead of throwing", () => {
    const instant = new Date("2026-06-02T12:00:00Z");
    expect(periodKeyFor("MORNING", instant, "Not/AZone")).toBe("2026-06-02");
  });
});

describe("isoWeek", () => {
  it("handles the year-boundary week-year correctly", () => {
    // 2027-01-01 is a Friday → belongs to ISO week 53 of 2026.
    expect(isoWeek(2027, 1, 1)).toEqual({ week: 53, year: 2026 });
    // 2026-01-01 is a Thursday → ISO week 1 of 2026.
    expect(isoWeek(2026, 1, 1)).toEqual({ week: 1, year: 2026 });
  });
});

describe("isWithinQuietHours", () => {
  it("returns false when either bound is null or the window is empty", () => {
    expect(isWithinQuietHours(600, null, 420)).toBe(false);
    expect(isWithinQuietHours(600, 1320, null)).toBe(false);
    expect(isWithinQuietHours(600, 480, 480)).toBe(false);
  });

  it("handles same-day windows [start, end)", () => {
    expect(isWithinQuietHours(540, 480, 600)).toBe(true); // 09:00 in [08:00,10:00)
    expect(isWithinQuietHours(600, 480, 600)).toBe(false); // end is exclusive
    expect(isWithinQuietHours(420, 480, 600)).toBe(false);
  });

  it("handles windows that wrap past midnight (22:00→07:00)", () => {
    const start = 22 * 60; // 1320
    const end = 7 * 60; // 420
    expect(isWithinQuietHours(23 * 60, start, end)).toBe(true); // 23:00
    expect(isWithinQuietHours(3 * 60, start, end)).toBe(true); // 03:00
    expect(isWithinQuietHours(7 * 60, start, end)).toBe(false); // 07:00 exclusive
    expect(isWithinQuietHours(12 * 60, start, end)).toBe(false); // noon
  });

  it("localMinutes reflects the timezone", () => {
    const instant = new Date("2026-06-02T12:00:00Z"); // 08:00 in NY (UTC-4)
    expect(localMinutes(instant, "America/New_York")).toBe(8 * 60);
    expect(localMinutes(instant, "UTC")).toBe(12 * 60);
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects junk", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

// ---------- buildPortfolioReview ----------

function scores(overrides: Partial<PortfolioScores> = {}): PortfolioScores {
  return {
    status: "scored",
    healthScore: 80,
    riskScore: 40,
    diversificationScore: 75,
    cashScore: 90,
    totalValue: 10000,
    invested: 9500,
    cash: 500,
    cashPct: 5,
    holdingsCount: 5,
    sectorConcentration: [
      { sector: "Technology", pct: 30 },
      { sector: "Healthcare", pct: 25 },
      { sector: "Energy", pct: 25 },
      { sector: "Financials", pct: 20 },
    ],
    overweight: [],
    underweight: [],
    strengths: [],
    weaknesses: [],
    improvements: [],
    ...overrides,
  };
}

const asOf = new Date("2026-06-02T13:00:00Z");

function baseInput(overrides: Partial<BuildReviewInput> = {}): BuildReviewInput {
  return {
    period: "MORNING",
    asOf,
    scores: scores(),
    holdings: [
      { ticker: "AAPL", marketValue: 2000 },
      { ticker: "MSFT", marketValue: 2000 },
    ],
    earnings: [],
    ...overrides,
  };
}

describe("buildPortfolioReview", () => {
  it("produces a clean review with no flags for a balanced portfolio", () => {
    const r = buildPortfolioReview(baseInput());
    expect(r.flags).toHaveLength(0);
    expect(r.headline).toContain("no flags to review");
    expect(r.healthScore).toBe(80);
    expect(r.topSectors.length).toBeLessThanOrEqual(5);
  });

  it("flags a concentrated sector at/above the threshold", () => {
    const r = buildPortfolioReview(
      baseInput({
        scores: scores({
          sectorConcentration: [
            { sector: "Technology", pct: 40 },
            { sector: "Healthcare", pct: 35 },
            { sector: "Energy", pct: 25 },
          ],
        }),
      }),
    );
    const conc = r.flags.filter((f) => f.type === "concentration");
    expect(conc).toHaveLength(2); // 40 and 35 both >= 35
    expect(conc[0]?.severity).toBe("warn");
  });

  it("flags an outsized single position by share of total value", () => {
    const r = buildPortfolioReview(
      baseInput({
        holdings: [
          { ticker: "TSLA", marketValue: 3000 }, // 30% of 10000
          { ticker: "AAPL", marketValue: 1000 },
        ],
      }),
    );
    const pos = r.flags.filter((f) => f.type === "position_size");
    expect(pos).toHaveLength(1);
    expect(pos[0]?.tickers).toEqual(["TSLA"]);
    expect(pos[0]?.title).toContain("30%");
  });

  it("flags earnings only for held tickers within the window", () => {
    const r = buildPortfolioReview(
      baseInput({
        holdings: [
          { ticker: "AAPL", marketValue: 2000 },
          { ticker: "MSFT", marketValue: 2000 },
        ],
        earnings: [
          { ticker: "AAPL", date: new Date("2026-06-05T13:00:00Z") }, // in 3d → flagged
          { ticker: "MSFT", date: new Date("2026-06-20T13:00:00Z") }, // 18d → out of window
          { ticker: "NVDA", date: new Date("2026-06-03T13:00:00Z") }, // not held → ignored
        ],
      }),
    );
    const earn = r.flags.filter((f) => f.type === "earnings");
    expect(earn).toHaveLength(1);
    expect(earn[0]?.tickers).toEqual(["AAPL"]);
  });

  it("flags high cash as a potential drag", () => {
    const r = buildPortfolioReview(
      baseInput({ scores: scores({ cashPct: 25, cashScore: 40 }) }),
    );
    const cash = r.flags.filter((f) => f.type === "cash");
    expect(cash).toHaveLength(1);
    expect(cash[0]?.severity).toBe("warn");
    expect(cash[0]?.title).toContain("25%");
  });

  it("flags a thin cash buffer as info", () => {
    const r = buildPortfolioReview(
      baseInput({ scores: scores({ cashPct: 1, cashScore: 70 }) }),
    );
    const cash = r.flags.filter((f) => f.type === "cash");
    expect(cash).toHaveLength(1);
    expect(cash[0]?.severity).toBe("info");
  });

  it("is deterministic — identical inputs yield identical content", () => {
    const a = buildPortfolioReview(baseInput());
    const b = buildPortfolioReview(baseInput());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
