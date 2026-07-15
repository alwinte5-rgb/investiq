/**
 * Forex display helpers — PURE functions behind the UX layer: grouping
 * calendar events by the viewer's local day, and expressing a pair's typical
 * range (ATR) in money. Kept here so they are unit-testable.
 */

import { getRate, type RateTable } from "./conversion.js";
import { pipSizeFor, splitPair } from "./pips.js";

export interface DayGroup<T> {
  /** Stable key: the local date as yyyy-mm-dd. */
  key: string;
  /** Human heading, e.g. "Today — July 15" / "Tomorrow — July 16" / "Friday — July 17". */
  label: string;
  items: T[];
}

function localDateKey(d: Date, timeZone?: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    ...(timeZone ? { timeZone } : {}),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(d); // en-CA yields yyyy-mm-dd
}

/**
 * Group time-stamped items by the viewer's LOCAL calendar day, chronological
 * within each group; groups appear in chronological order and empty days are
 * simply absent. `now` and `timeZone` are injectable for tests.
 */
export function groupByLocalDay<T>(
  items: T[],
  timeOf: (item: T) => string | Date,
  opts?: { now?: Date; timeZone?: string },
): DayGroup<T>[] {
  const now = opts?.now ?? new Date();
  const todayKey = localDateKey(now, opts?.timeZone);
  const tomorrowKey = localDateKey(new Date(now.getTime() + 86_400_000), opts?.timeZone);

  const sorted = [...items].sort(
    (a, b) => new Date(timeOf(a)).getTime() - new Date(timeOf(b)).getTime(),
  );

  const groups = new Map<string, DayGroup<T>>();
  for (const item of sorted) {
    const when = new Date(timeOf(item));
    const key = localDateKey(when, opts?.timeZone);
    let group = groups.get(key);
    if (!group) {
      const dayName = new Intl.DateTimeFormat("en-US", {
        ...(opts?.timeZone ? { timeZone: opts.timeZone } : {}),
        weekday: "long",
      }).format(when);
      const monthDay = new Intl.DateTimeFormat("en-US", {
        ...(opts?.timeZone ? { timeZone: opts.timeZone } : {}),
        month: "long",
        day: "numeric",
      }).format(when);
      const prefix = key === todayKey ? "Today" : key === tomorrowKey ? "Tomorrow" : dayName;
      group = { key, label: `${prefix} — ${monthDay}`, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return [...groups.values()];
}

export interface AtrMoneyInput {
  pairSymbol: string;
  atrPips: number;
  /** Units to express the movement over (spec example: 1,000). */
  units: number;
  accountCurrency: string;
  /** Rates for quote→account conversion (the pair's own rate suffices for base/quote accounts). */
  rates: RateTable;
}

export interface AtrMoneyResult {
  amount: number;
  currency: string;
  /** False when quote→account conversion wasn't possible (amount is in quote currency). */
  converted: boolean;
}

/**
 * Money moved by `atrPips` for a position of `units`, in the account currency
 * when convertible (falls back to the quote currency, flagged `converted:false`).
 */
export function atrMoneyForUnits({ pairSymbol, atrPips, units, accountCurrency, rates }: AtrMoneyInput): AtrMoneyResult | null {
  const parts = splitPair(pairSymbol);
  if (!parts || !(atrPips > 0) || !(units > 0)) return null;
  const quoteAmount = atrPips * pipSizeFor(pairSymbol) * units;
  const rate = getRate(parts.quote, accountCurrency, rates);
  if (rate == null) return { amount: quoteAmount, currency: parts.quote, converted: false };
  return { amount: quoteAmount * rate, currency: accountCurrency, converted: true };
}
