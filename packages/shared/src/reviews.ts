/**
 * Layer 4 — AI Portfolio Manager (deterministic core).
 *
 * PURE helpers for scheduled reviews/briefings: timezone-aware period keys
 * (used for once-per-period idempotency), quiet-hours math, and the review
 * content builder. No clock of their own, no I/O, no model calls — given the
 * same inputs they always produce the same output, so a stored PortfolioReview
 * is reproducible. Educational / non-advisory framing: "flags" and "suggested
 * focus", never directives.
 */

import type { PortfolioScores, SectorWeight } from "./portfolio.js";

export type ReviewPeriod = "MORNING" | "WEEKLY" | "MONTHLY";

// ---------- Timezone-aware local calendar ----------

interface LocalParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  hour: number; // 0..23
  minute: number; // 0..59
}

const UTC_FALLBACK = "UTC";

/** Local Y/M/D/H/M for an instant in an IANA timezone. Falls back to UTC if the
 * timezone string is invalid so a single bad preference can't crash a job. */
export function localParts(date: Date, timezone: string): LocalParts {
  let tz = timezone;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
  } catch {
    tz = UTC_FALLBACK;
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
  }
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  let hour = get("hour");
  if (hour === 24) hour = 0; // some engines render midnight as 24
  return { year: get("year"), month: get("month"), day: get("day"), hour, minute: get("minute") };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** ISO-8601 week number + week-year for a calendar date (no timezone math). */
export function isoWeek(year: number, month: number, day: number): { week: number; year: number } {
  // Work in UTC purely as calendar arithmetic; the Y/M/D is already localized.
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // move to the Thursday of this week
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { week, year: isoYear };
}

/**
 * Stable key identifying the period an instant falls in, in the user's timezone.
 * MORNING → "YYYY-MM-DD", WEEKLY → "YYYY-Www" (ISO), MONTHLY → "YYYY-MM".
 * The (userId, period, periodKey) unique constraint makes generation idempotent.
 */
export function periodKeyFor(period: ReviewPeriod, date: Date, timezone: string): string {
  const p = localParts(date, timezone);
  switch (period) {
    case "MORNING":
      return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
    case "MONTHLY":
      return `${p.year}-${pad2(p.month)}`;
    case "WEEKLY": {
      const { week, year } = isoWeek(p.year, p.month, p.day);
      return `${year}-W${pad2(week)}`;
    }
  }
}

/** Local day-of-week in a timezone: 0=Sunday .. 6=Saturday. */
export function localWeekday(date: Date, timezone: string): number {
  let tz = timezone;
  let wd: string;
  try {
    wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  } catch {
    tz = UTC_FALLBACK;
    wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  }
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd] ?? 0;
}

/**
 * Which review periods a single daily scheduled run should generate for a given
 * date, in a reference timezone: MORNING every day, WEEKLY on Mondays, MONTHLY
 * on the 1st. Lets one daily cron cover all three cadences. Pure + testable.
 */
export function autoReviewPeriods(date: Date, timezone = "America/New_York"): ReviewPeriod[] {
  const { day } = localParts(date, timezone);
  const periods: ReviewPeriod[] = ["MORNING"];
  if (localWeekday(date, timezone) === 1) periods.push("WEEKLY");
  if (day === 1) periods.push("MONTHLY");
  return periods;
}

// ---------- Quiet hours ----------

/** Minutes-from-local-midnight (0..1439) for an instant in a timezone. */
export function localMinutes(date: Date, timezone: string): number {
  const p = localParts(date, timezone);
  return p.hour * 60 + p.minute;
}

/**
 * True if `minutes` (local minutes-from-midnight) falls inside [start, end).
 * Supports windows that wrap midnight (e.g. 22:00→07:00). A null bound or an
 * empty window (start === end) means "no quiet hours".
 */
export function isWithinQuietHours(
  minutes: number,
  start: number | null | undefined,
  end: number | null | undefined,
): boolean {
  if (start == null || end == null || start === end) return false;
  if (start < end) return minutes >= start && minutes < end;
  // Wraps past midnight.
  return minutes >= start || minutes < end;
}

// ---------- Review content builder ----------

/** A sector is "concentrated" at or above this share of invested value. */
export const CONCENTRATION_FLAG_PCT = 35;
/** A single holding is "outsized" at or above this share of total value. */
export const POSITION_FLAG_PCT = 25;
/** Earnings within this many days of the review is flagged as event risk. */
export const EARNINGS_WINDOW_DAYS = 7;
/** Cash above this share of total value is flagged as potential drag. */
export const HIGH_CASH_PCT = 15;
/** Cash below this share leaves a thin buffer. */
export const LOW_CASH_PCT = 2;

export type FlagType = "concentration" | "position_size" | "earnings" | "cash";
export type FlagSeverity = "info" | "warn";

export interface ReviewFlag {
  type: FlagType;
  severity: FlagSeverity;
  title: string;
  detail: string;
  tickers?: string[];
}

export interface ReviewContent {
  period: ReviewPeriod;
  asOf: string; // ISO timestamp the review was computed for
  headline: string;
  summary: string;
  healthScore: number;
  riskScore: number;
  diversificationScore: number;
  cashScore: number;
  totalValue: number;
  cashPct: number;
  topSectors: SectorWeight[];
  flags: ReviewFlag[];
}

export interface ReviewHolding {
  ticker: string;
  marketValue: number;
}

/** An upcoming/recent earnings date for a held ticker. */
export interface ReviewEarnings {
  ticker: string;
  date: Date;
}

export interface BuildReviewInput {
  period: ReviewPeriod;
  asOf: Date;
  scores: PortfolioScores;
  holdings: ReviewHolding[];
  earnings: ReviewEarnings[];
}

const PERIOD_LABEL: Record<ReviewPeriod, string> = {
  MORNING: "Morning briefing",
  WEEKLY: "Weekly review",
  MONTHLY: "Monthly review",
};

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Build the stored review content from already-computed deterministic scores
 * plus the user's holdings and held-ticker earnings dates. Pure: same inputs →
 * same content. Flags are derived only from supplied data (never invented).
 */
export function buildPortfolioReview(input: BuildReviewInput): ReviewContent {
  const { period, asOf, scores, holdings, earnings } = input;
  const total = scores.totalValue;
  const flags: ReviewFlag[] = [];

  // Concentration — deterministic order (sectorConcentration is sorted desc).
  const concentrated = scores.sectorConcentration.filter((s) => s.pct >= CONCENTRATION_FLAG_PCT);
  for (const s of concentrated) {
    flags.push({
      type: "concentration",
      severity: "warn",
      title: `${s.sector} is ${Math.round(s.pct)}% of invested value`,
      detail: `A large share of your invested value sits in ${s.sector}. Concentrated exposure raises how much a single sector's move can swing the portfolio.`,
      tickers: [],
    });
  }

  // Outsized single positions — by share of TOTAL value (cash included).
  if (total > 0) {
    const outsized = holdings
      .filter((h) => h.marketValue / total >= POSITION_FLAG_PCT / 100)
      .sort((a, b) => b.marketValue - a.marketValue);
    for (const h of outsized) {
      const pct = Math.round((h.marketValue / total) * 100);
      flags.push({
        type: "position_size",
        severity: "warn",
        title: `${h.ticker} is ${pct}% of the portfolio`,
        detail: `${h.ticker} is an outsized single position. Sizing this large means its individual outcome drives much of your result.`,
        tickers: [h.ticker],
      });
    }
  }

  // Earnings event risk within the window, for held tickers only.
  const held = new Set(holdings.map((h) => h.ticker));
  const upcoming = earnings
    .filter((e) => held.has(e.ticker))
    .map((e) => ({ ticker: e.ticker, inDays: daysBetween(asOf, e.date) }))
    .filter((e) => e.inDays >= 0 && e.inDays <= EARNINGS_WINDOW_DAYS)
    .sort((a, b) => a.inDays - b.inDays);
  if (upcoming.length > 0) {
    flags.push({
      type: "earnings",
      severity: "info",
      title: `Earnings ahead for ${upcoming.length} holding${upcoming.length > 1 ? "s" : ""}`,
      detail: `Earnings can move a stock sharply. Holdings reporting within ${EARNINGS_WINDOW_DAYS} days: ${upcoming
        .map((e) => `${e.ticker} (${e.inDays === 0 ? "today" : `${e.inDays}d`})`)
        .join(", ")}.`,
      tickers: upcoming.map((e) => e.ticker),
    });
  }

  // Cash posture.
  if (scores.cashPct >= HIGH_CASH_PCT) {
    flags.push({
      type: "cash",
      severity: "warn",
      title: `Cash is ${Math.round(scores.cashPct)}% of the portfolio`,
      detail: `A high cash share can be a drag on long-term returns if it is unintentional. Worth confirming it matches your plan.`,
    });
  } else if (scores.cashPct < LOW_CASH_PCT) {
    flags.push({
      type: "cash",
      severity: "info",
      title: `Cash is under ${LOW_CASH_PCT}% of the portfolio`,
      detail: `A thin cash buffer leaves little dry powder for opportunities or unexpected needs.`,
    });
  }

  const warnings = flags.filter((f) => f.severity === "warn").length;
  const headline = `${PERIOD_LABEL[period]}: health ${scores.healthScore}/100, ${
    warnings === 0 ? "no flags to review" : `${warnings} item${warnings > 1 ? "s" : ""} to review`
  }`;
  const summary =
    warnings === 0
      ? `Your portfolio health is ${scores.healthScore}/100 with diversification ${scores.diversificationScore}/100 and risk ${scores.riskScore}/100. Nothing stands out as needing attention this ${period === "MORNING" ? "morning" : "period"}.`
      : `Your portfolio health is ${scores.healthScore}/100. There ${warnings === 1 ? "is" : "are"} ${warnings} item${warnings > 1 ? "s" : ""} worth a look: ${flags
          .filter((f) => f.severity === "warn")
          .map((f) => f.title)
          .join("; ")}.`;

  return {
    period,
    asOf: asOf.toISOString(),
    headline,
    summary,
    healthScore: scores.healthScore,
    riskScore: scores.riskScore,
    diversificationScore: scores.diversificationScore,
    cashScore: scores.cashScore,
    totalValue: scores.totalValue,
    cashPct: scores.cashPct,
    topSectors: scores.sectorConcentration.slice(0, 5),
    flags,
  };
}

/** Validate an IANA timezone string (used by the preferences validator). */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
