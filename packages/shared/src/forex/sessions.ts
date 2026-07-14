/**
 * Forex core — market sessions (Sydney, Tokyo, London, New York).
 *
 * Session windows are defined in each city's OWN IANA timezone so daylight-
 * saving shifts are handled by `Intl`, never hardcoded UTC offsets. The clock
 * is an explicit argument, so status/countdowns are fully testable.
 */

export interface SessionDefinition {
  id: "SYDNEY" | "TOKYO" | "LONDON" | "NEW_YORK";
  name: string;
  timeZone: string;
  /** Local wall-clock open/close hour (24h). Sessions run Mon–Fri local. */
  openHour: number;
  closeHour: number;
  /** Pairs that are commonly most active during the session (educational). */
  activePairs: string[];
}

export const MARKET_SESSIONS: SessionDefinition[] = [
  {
    id: "SYDNEY",
    name: "Sydney",
    timeZone: "Australia/Sydney",
    openHour: 7,
    closeHour: 16,
    activePairs: ["AUD/USD", "NZD/USD", "AUD/JPY"],
  },
  {
    id: "TOKYO",
    name: "Tokyo",
    timeZone: "Asia/Tokyo",
    openHour: 9,
    closeHour: 18,
    activePairs: ["USD/JPY", "EUR/JPY", "GBP/JPY", "AUD/JPY"],
  },
  {
    id: "LONDON",
    name: "London",
    timeZone: "Europe/London",
    openHour: 8,
    closeHour: 17,
    activePairs: ["EUR/USD", "GBP/USD", "EUR/GBP", "USD/CHF"],
  },
  {
    id: "NEW_YORK",
    name: "New York",
    timeZone: "America/New_York",
    openHour: 8,
    closeHour: 17,
    activePairs: ["EUR/USD", "GBP/USD", "USD/CAD", "USD/JPY"],
  },
];

interface WallClock {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday … 6 = Saturday
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function wallClockIn(timeZone: string, at: Date): WallClock {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(at)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24, // Intl can emit "24" at midnight
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS.indexOf(parts.weekday ?? ""),
  };
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(timeZone: string, at: Date): number {
  const wc = wallClockIn(timeZone, at);
  const asUtc = Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute, wc.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Convert a wall-clock time in `timeZone` to a UTC instant (DST-aware, two-pass). */
function wallTimeToUtc(timeZone: string, year: number, month: number, day: number, hour: number, minute = 0): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  let guess = naive - tzOffsetMs(timeZone, new Date(naive));
  guess = naive - tzOffsetMs(timeZone, new Date(guess));
  return new Date(guess);
}

export interface SessionStatus {
  id: SessionDefinition["id"];
  name: string;
  timeZone: string;
  isOpen: boolean;
  /** Local session wall-clock window, e.g. "08:00–17:00". */
  localWindow: string;
  /** Current local time in the session's city, e.g. "Tue 14:32". */
  localTime: string;
  /** The next open/close boundary as an ISO instant. */
  nextOpenAt: string;
  nextCloseAt: string;
  /** Minutes until the next status change (open → close or close → open). */
  minutesUntilChange: number;
  activePairs: string[];
}

const pad = (n: number) => String(n).padStart(2, "0");

function isWeekday(weekday: number): boolean {
  return weekday >= 1 && weekday <= 5;
}

/** Compute one session's status at `now`. */
export function sessionStatus(def: SessionDefinition, now: Date): SessionStatus {
  const wc = wallClockIn(def.timeZone, now);
  const minutesNow = wc.hour * 60 + wc.minute;
  const isOpen = isWeekday(wc.weekday) && minutesNow >= def.openHour * 60 && minutesNow < def.closeHour * 60;

  // Scan the local calendar (yesterday → +8 days) for the surrounding open/close instants.
  let nextOpen: Date | null = null;
  let nextClose: Date | null = null;
  for (let offset = -1; offset <= 8 && (nextOpen == null || nextClose == null); offset++) {
    const probe = new Date(now.getTime() + offset * 86_400_000);
    const day = wallClockIn(def.timeZone, probe);
    if (!isWeekday(day.weekday)) continue;
    const open = wallTimeToUtc(def.timeZone, day.year, day.month, day.day, def.openHour);
    const close = wallTimeToUtc(def.timeZone, day.year, day.month, day.day, def.closeHour);
    if (nextOpen == null && open.getTime() > now.getTime()) nextOpen = open;
    if (nextClose == null && close.getTime() > now.getTime()) nextClose = close;
  }

  const boundary = isOpen ? nextClose : nextOpen;
  const minutesUntilChange = boundary ? Math.max(0, Math.round((boundary.getTime() - now.getTime()) / 60_000)) : 0;

  return {
    id: def.id,
    name: def.name,
    timeZone: def.timeZone,
    isOpen,
    localWindow: `${pad(def.openHour)}:00–${pad(def.closeHour)}:00`,
    localTime: `${WEEKDAYS[wc.weekday]} ${pad(wc.hour)}:${pad(wc.minute)}`,
    nextOpenAt: (nextOpen ?? now).toISOString(),
    nextCloseAt: (nextClose ?? now).toISOString(),
    minutesUntilChange,
    activePairs: def.activePairs,
  };
}

export interface SessionsSnapshot {
  at: string;
  sessions: SessionStatus[];
  /** Names of sessions currently open at the same time, e.g. ["London", "New York"]. */
  overlap: string[];
}

/** Status for all four sessions plus the current overlap. */
export function sessionsSnapshot(now: Date = new Date()): SessionsSnapshot {
  const sessions = MARKET_SESSIONS.map((def) => sessionStatus(def, now));
  const open = sessions.filter((s) => s.isOpen).map((s) => s.name);
  return { at: now.toISOString(), sessions, overlap: open.length >= 2 ? open : [] };
}

/** Format an instant in the user's own timezone (falls back to UTC when invalid). */
export function formatInUserZone(iso: string, userTimeZone: string): string {
  const date = new Date(iso);
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: userTimeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

// Timezone validation lives in reviews.ts (`isValidTimeZone`) — reused, not duplicated.
