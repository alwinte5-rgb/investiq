import { describe, it, expect } from "vitest";
import { MARKET_SESSIONS, sessionStatus, sessionsSnapshot, formatInUserZone } from "./sessions.js";
import { isValidTimeZone } from "../reviews.js";

const london = MARKET_SESSIONS.find((s) => s.id === "LONDON")!;
const newYork = MARKET_SESSIONS.find((s) => s.id === "NEW_YORK")!;
const sydney = MARKET_SESSIONS.find((s) => s.id === "SYDNEY")!;

describe("sessionStatus", () => {
  it("London is open mid-afternoon on a summer Wednesday (BST — DST-aware)", () => {
    // 2026-07-15 is a Wednesday; 13:00 UTC = 14:00 London (BST).
    const s = sessionStatus(london, new Date("2026-07-15T13:00:00Z"));
    expect(s.isOpen).toBe(true);
    expect(s.localTime).toMatch(/^Wed 14:00$/);
  });

  it("London is open at the same UTC wall time in winter too (GMT)", () => {
    // 2026-01-14 is a Wednesday; 13:00 UTC = 13:00 London (GMT).
    const s = sessionStatus(london, new Date("2026-01-14T13:00:00Z"));
    expect(s.isOpen).toBe(true);
    expect(s.localTime).toMatch(/^Wed 13:00$/);
  });

  it("sessions are closed on weekends with a countdown to Monday's open", () => {
    // 2026-07-18 is a Saturday.
    const s = sessionStatus(london, new Date("2026-07-18T13:00:00Z"));
    expect(s.isOpen).toBe(false);
    expect(s.minutesUntilChange).toBeGreaterThan(0);
    expect(new Date(s.nextOpenAt).getUTCDay()).toBe(1); // Monday
  });

  it("counts down to close while open", () => {
    // London closes 17:00 local; at 14:00 BST there are 180 minutes left.
    const s = sessionStatus(london, new Date("2026-07-15T13:00:00Z"));
    expect(s.minutesUntilChange).toBe(180);
  });

  it("Sydney reflects its own timezone (AEST in July)", () => {
    // 2026-07-15 01:00 UTC = 11:00 Wed in Sydney (AEST, UTC+10) → open (07–16).
    const s = sessionStatus(sydney, new Date("2026-07-15T01:00:00Z"));
    expect(s.isOpen).toBe(true);
    expect(s.localTime).toMatch(/^Wed 11:00$/);
  });
});

describe("sessionsSnapshot overlaps", () => {
  it("detects the London–New York overlap", () => {
    // 14:00 UTC in July: London 15:00 (open), New York 10:00 (open).
    const snap = sessionsSnapshot(new Date("2026-07-15T14:00:00Z"));
    expect(snap.overlap).toContain("London");
    expect(snap.overlap).toContain("New York");
  });

  it("reports no overlap when at most one session is open", () => {
    // 04:00 UTC Sunday: everything closed.
    const snap = sessionsSnapshot(new Date("2026-07-19T04:00:00Z"));
    expect(snap.overlap).toEqual([]);
    expect(snap.sessions.every((s) => !s.isOpen)).toBe(true);
  });
});

describe("timezone helpers", () => {
  it("formats instants in the user's zone and validates zone names", () => {
    const formatted = formatInUserZone("2026-07-15T13:00:00Z", "America/New_York");
    expect(formatted).toMatch(/09:00/); // EDT = UTC-4
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });

  it("New York close boundary is DST-correct", () => {
    // NY closes 17:00 local. In July that is 21:00 UTC.
    const s = sessionStatus(newYork, new Date("2026-07-15T20:59:00Z"));
    expect(s.isOpen).toBe(true);
    const after = sessionStatus(newYork, new Date("2026-07-15T21:00:00Z"));
    expect(after.isOpen).toBe(false);
  });
});
