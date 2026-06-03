"use client";

import { useState, useTransition } from "react";
import {
  updatePreferencesAction,
  type NotificationPreferences,
} from "@/app/(authed)/settings/actions";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
];

const minutesToTime = (m: number | null): string => {
  if (m == null) return "22:00";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
};
const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );
}

export function NotificationSettingsUI({ initial }: { initial: NotificationPreferences }) {
  const [p, setP] = useState<NotificationPreferences>(initial);
  const [quietOn, setQuietOn] = useState(initial.quietHoursStart != null);
  const [startTime, setStartTime] = useState(minutesToTime(initial.quietHoursStart));
  const [endTime, setEndTime] = useState(minutesToTime(initial.quietHoursEnd));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const set = (patch: Partial<NotificationPreferences>) => {
    setP((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  function save() {
    setError(null);
    setSaved(false);
    const patch: Partial<NotificationPreferences> = {
      timezone: p.timezone,
      emailEnabled: p.emailEnabled,
      pushEnabled: p.pushEnabled,
      morningBriefing: p.morningBriefing,
      weeklyReview: p.weeklyReview,
      monthlyReview: p.monthlyReview,
      quietHoursStart: quietOn ? timeToMinutes(startTime) : null,
      quietHoursEnd: quietOn ? timeToMinutes(endTime) : null,
    };
    start(async () => {
      const res = await updatePreferencesAction(patch);
      if (res.ok) {
        setP(res.prefs);
        setQuietOn(res.prefs.quietHoursStart != null);
        setSaved(true);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-semibold">Timezone</h3>
        <select
          value={TIMEZONES.includes(p.timezone) ? p.timezone : "UTC"}
          onChange={(e) => set({ timezone: e.target.value })}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          {(TIMEZONES.includes(p.timezone) ? TIMEZONES : [p.timezone, ...TIMEZONES]).map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-500">
          Used to schedule briefings and apply quiet hours.
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-1 text-sm font-semibold">Channels</h3>
        <div className="divide-y">
          <Toggle label="Email" checked={p.emailEnabled} onChange={(v) => set({ emailEnabled: v })} />
          <Toggle label="Push" checked={p.pushEnabled} onChange={(v) => set({ pushEnabled: v })} />
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-1 text-sm font-semibold">Reviews</h3>
        <div className="divide-y">
          <Toggle
            label="Morning briefing"
            checked={p.morningBriefing}
            onChange={(v) => set({ morningBriefing: v })}
          />
          <Toggle
            label="Weekly review"
            checked={p.weeklyReview}
            onChange={(v) => set({ weeklyReview: v })}
          />
          <Toggle
            label="Monthly review"
            checked={p.monthlyReview}
            onChange={(v) => set({ monthlyReview: v })}
          />
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <Toggle
          label="Quiet hours (mute email & push)"
          checked={quietOn}
          onChange={(v) => {
            setQuietOn(v);
            setSaved(false);
          }}
        />
        {quietOn && (
          <div className="mt-2 flex items-center gap-3 text-sm">
            <label className="flex items-center gap-1">
              From
              <input
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setSaved(false);
                }}
                className="rounded-md border px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-1">
              To
              <input
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setSaved(false);
                }}
                className="rounded-md border px-2 py-1"
              />
            </label>
          </div>
        )}
        <p className="mt-1 text-xs text-neutral-500">
          In-app notifications are always recorded; quiet hours only mute email and push.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save preferences"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
