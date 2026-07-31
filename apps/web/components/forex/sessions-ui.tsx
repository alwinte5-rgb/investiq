"use client";

import { useEffect, useState } from "react";
import { sessionsSnapshot, formatInUserZone, type SessionsSnapshot } from "@investiq/shared/forex";

/**
 * Market sessions — computed client-side from the shared DST-aware engine and
 * refreshed every 30s. `compact` renders the dashboard strip; the full page
 * adds countdowns, user-local times, and active pairs.
 */

function countdown(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  if (h < 48) return `${h}h ${minutes % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function SessionsUI({ compact = false }: { compact?: boolean }) {
  // Render nothing time-dependent on the server pass to avoid hydration drift.
  const [snap, setSnap] = useState<SessionsSnapshot | null>(null);
  const [userTz, setUserTz] = useState("UTC");

  useEffect(() => {
    setUserTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    const tick = () => setSnap(sessionsSnapshot());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!snap) {
    return <div className="rounded-lg border p-4 text-sm text-t3">Loading sessions…</div>;
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {snap.sessions.map((s) => (
          <span
            key={s.id}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
              s.isOpen ? "border-pos bg-pos-soft text-pos" : "border-edge text-t3"
            }`}
          >
            <span aria-hidden="true">{s.isOpen ? "●" : "○"}</span>
            {s.name} {s.isOpen ? "Open" : "Closed"}
            <span className="text-t3">· {s.isOpen ? "closes" : "opens"} in {countdown(s.minutesUntilChange)}</span>
          </span>
        ))}
        {snap.overlap.length >= 2 && (
          <span className="rounded-full border border-accent bg-accent-soft px-3 py-1 text-xs text-accent">
            {snap.overlap.join(" + ")} overlap — typically the most liquid hours
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {snap.overlap.length >= 2 && (
        <p className="rounded-md border border-accent bg-accent-soft p-3 text-sm text-accent">
          <strong>{snap.overlap.join(" + ")}</strong> are open at the same time right now — session
          overlaps are typically the most liquid hours of the day.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {snap.sessions.map((s) => (
          <div key={s.id} className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-t1">{s.name}</h3>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  s.isOpen ? "border-pos bg-pos-soft text-pos" : "border-edge text-t3"
                }`}
              >
                {s.isOpen ? "Open" : "Closed"}
              </span>
            </div>
            <dl className="mt-2 space-y-1 text-xs text-t2">
              <div className="flex justify-between">
                <dt>Session hours (local)</dt>
                <dd className="tabular-nums">{s.localWindow}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Time in {s.name} now</dt>
                <dd className="tabular-nums">{s.localTime}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{s.isOpen ? "Closes" : "Opens"} in</dt>
                <dd className="tabular-nums">{countdown(s.minutesUntilChange)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{s.isOpen ? "Closes" : "Opens"} (your time)</dt>
                <dd className="tabular-nums">
                  {formatInUserZone(s.isOpen ? s.nextCloseAt : s.nextOpenAt, userTz)}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-[11px] text-t3">
              Commonly active: {s.activePairs.join(", ")}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-t3">
        Times follow each city&apos;s own clock, including daylight-saving changes. Your timezone:{" "}
        {userTz}.
      </p>
    </div>
  );
}
