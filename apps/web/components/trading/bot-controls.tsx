"use client";

import { useState, useTransition } from "react";
import { Pill } from "./ui";

/** Per-bot limit controls.
 *
 * Control is PULL-based: this writes the DESIRED values to the API; the Mac's
 * sync cron applies them within ~15 min and stamps appliedAt. The UI shows
 * desired-vs-applied rather than pretending a change is instant.
 *
 * Ranges here mirror the server-side bounds (the API re-validates — a dropdown
 * is never the guardrail). "Default" clears the override so the bot reverts to
 * its gauntlet-validated setting. */

export type BotControl = {
  botName: string;
  riskPct: number | null;
  maxExposure: number | null;
  paperEquity: number | null;
  stopPct: number | null;
  takeProfit: boolean | null;
  desiredStatus: string | null;
  updatedAt: string;
  appliedAt: string | null;
};

const RISK = [0.0025, 0.005, 0.01, 0.02, 0.03];
const EXPOSURE = [0.05, 0.1, 0.15, 0.25];
const EQUITY = [100, 250, 500, 1000, 5000, 10000];
const STOP = [0.02, 0.03, 0.06, 0.1, 0.15];

function Select({
  label,
  value,
  options,
  format,
  onChange,
  disabled,
}: {
  label: string;
  value: number | null;
  options: number[];
  format: (n: number) => string;
  onChange: (v: number | null) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-t3">{label}</span>
      <select
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="rounded-md border border-edge bg-raised px-2 py-1.5 text-sm text-t1 disabled:opacity-50"
      >
        <option value="">Default</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {format(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function BotControls({
  botName,
  initial,
  benched,
}: {
  botName: string;
  initial?: BotControl;
  benched: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState({
    riskPct: initial?.riskPct ?? null,
    maxExposure: initial?.maxExposure ?? null,
    paperEquity: initial?.paperEquity ?? null,
    stopPct: initial?.stopPct ?? null,
    takeProfit: initial?.takeProfit ?? null,
    desiredStatus: initial?.desiredStatus ?? null,
  });

  const hasOverrides =
    state.riskPct != null ||
    state.maxExposure != null ||
    state.paperEquity != null ||
    state.stopPct != null ||
    state.takeProfit != null;
  const awaitingApply = initial ? !initial.appliedAt : false;

  function save(next: Partial<typeof state>) {
    const merged = { ...state, ...next };
    setState(merged);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/bot-controls/${encodeURIComponent(botName)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(merged),
        });
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
        setSaved("Queued — the bot picks this up within ~15 min");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <div className="mt-3 border-t border-edge pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-edge px-2.5 py-1 text-xs font-medium text-t2 hover:bg-raised"
        >
          {open ? "Hide limits" : "Limits & status"}
        </button>
        {hasOverrides ? <Pill tone="warn">modified from validated defaults</Pill> : null}
        {awaitingApply ? <Pill tone="accent">pending on Mac</Pill> : null}
        {initial?.appliedAt ? (
          <span className="text-[11px] text-t3">
            applied {new Date(initial.appliedAt).toLocaleString()}
          </span>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Select
              label="Risk / trade"
              value={state.riskPct}
              options={RISK}
              format={(n) => `${(n * 100).toFixed(2).replace(/0$/, "")}%`}
              onChange={(v) => save({ riskPct: v })}
              disabled={pending}
            />
            <Select
              label="Max exposure"
              value={state.maxExposure}
              options={EXPOSURE}
              format={(n) => `${(n * 100).toFixed(0)}%`}
              onChange={(v) => save({ maxExposure: v })}
              disabled={pending}
            />
            <Select
              label="Paper equity"
              value={state.paperEquity}
              options={EQUITY}
              format={(n) => `$${n.toLocaleString()}`}
              onChange={(v) => save({ paperEquity: v })}
              disabled={pending}
            />
            <Select
              label="Stop loss"
              value={state.stopPct}
              options={STOP}
              format={(n) => `${(n * 100).toFixed(0)}%`}
              onChange={(v) => save({ stopPct: v })}
              disabled={pending}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-t2">
              <span className="text-[11px] uppercase tracking-wider text-t3">Take-profit</span>
              <select
                disabled={pending}
                value={state.takeProfit === null ? "" : state.takeProfit ? "on" : "off"}
                onChange={(e) =>
                  save({
                    takeProfit: e.target.value === "" ? null : e.target.value === "on",
                  })
                }
                className="rounded-md border border-edge bg-raised px-2 py-1.5 text-sm text-t1 disabled:opacity-50"
              >
                <option value="">Default</option>
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </label>

            <button
              type="button"
              disabled={pending}
              onClick={() => save({ desiredStatus: benched ? "active" : "benched" })}
              className={
                benched
                  ? "rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
                  : "rounded-md border border-neg px-3 py-1.5 text-xs font-medium text-neg hover:bg-neg-soft disabled:opacity-50"
              }
            >
              {benched ? "Activate bot" : "Bench bot"}
            </button>
          </div>

          {saved ? <p className="text-xs text-pos">{saved}</p> : null}
          {error ? <p className="text-xs text-neg">{error}</p> : null}
          <p className="text-xs text-t3">
            Overrides make this bot&apos;s paper results diverge from its gauntlet-validated
            baseline — each change is logged to the bot&apos;s trade log.
          </p>
        </div>
      ) : null}
    </div>
  );
}
