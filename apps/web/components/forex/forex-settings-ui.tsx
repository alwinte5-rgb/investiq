"use client";

import { useState, useTransition } from "react";
import {
  updateForexSettingsAction,
  type ForexSettings,
} from "@/app/(authed)/settings/forex-actions";
import { CurrencySelect, Field, NumberInput, Select, num } from "./calc-ui";

/** Forex risk-profile settings form — the plan every calculator checks against. */
export function ForexSettingsUI({ initial }: { initial: ForexSettings }) {
  const [currency, setCurrency] = useState(initial.accountCurrency);
  const [balance, setBalance] = useState(String(Number(initial.defaultAccountBalance)));
  const [defaultRisk, setDefaultRisk] = useState(String(Number(initial.defaultRiskPercentage)));
  const [maxRisk, setMaxRisk] = useState(String(Number(initial.maximumRiskPercentage)));
  const [leverage, setLeverage] = useState(String(Number(initial.defaultLeverage)));
  const [rewardRatio, setRewardRatio] = useState(String(Number(initial.preferredRewardRatio)));
  const [lotDisplay, setLotDisplay] = useState(initial.preferredLotDisplay);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [warnMinutes, setWarnMinutes] = useState(String(initial.eventWarningMinutes));
  const [beginnerMode, setBeginnerMode] = useState(initial.beginnerMode);
  const [experience, setExperience] = useState(initial.experienceLevel ?? "");

  const [status, setStatus] = useState<{ kind: "ok" | "error"; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const detectTz = () => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

  const save = () => {
    setStatus(null);
    startTransition(async () => {
      const res = await updateForexSettingsAction({
        accountCurrency: currency,
        defaultAccountBalance: num(balance) ?? undefined,
        defaultRiskPercentage: num(defaultRisk) ?? undefined,
        maximumRiskPercentage: num(maxRisk) ?? undefined,
        defaultLeverage: num(leverage) ?? undefined,
        preferredRewardRatio: num(rewardRatio) ?? undefined,
        preferredLotDisplay: lotDisplay,
        timezone,
        eventWarningMinutes: num(warnMinutes) ?? undefined,
        beginnerMode,
        experienceLevel: experience || null,
      });
      setStatus(
        res.ok ? { kind: "ok", msg: "Settings saved." } : { kind: "error", msg: res.error },
      );
    });
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h2 className="text-sm font-semibold text-slate-800">Trading profile</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Account currency">
          <CurrencySelect value={currency} onChange={setCurrency} />
        </Field>
        <Field label="Account balance">
          <NumberInput value={balance} onChange={setBalance} ariaLabel="Account balance" />
        </Field>
        <Field label="Default risk %" hint="Per trade">
          <NumberInput value={defaultRisk} onChange={setDefaultRisk} ariaLabel="Default risk percentage" />
        </Field>
        <Field label="Maximum risk %" hint="Trades above this are Outside Plan">
          <NumberInput value={maxRisk} onChange={setMaxRisk} ariaLabel="Maximum risk percentage" />
        </Field>
        <Field label="Broker leverage" hint="e.g. 50 for 50:1">
          <NumberInput value={leverage} onChange={setLeverage} ariaLabel="Broker leverage" />
        </Field>
        <Field label="Min reward ratio" hint="e.g. 2 for 1:2">
          <NumberInput value={rewardRatio} onChange={setRewardRatio} ariaLabel="Preferred reward ratio" />
        </Field>
        <Field label="Show sizes as">
          <Select
            value={lotDisplay}
            onChange={(v) => setLotDisplay(v as "UNITS" | "LOTS")}
            ariaLabel="Preferred lot display"
            options={[
              { value: "UNITS", label: "Units (primary)" },
              { value: "LOTS", label: "Lots (primary)" },
            ]}
          />
        </Field>
        <Field label="Timezone">
          <div className="flex gap-1">
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              aria-label="Timezone"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={detectTz}
              className="whitespace-nowrap rounded-md border px-2 text-xs hover:bg-neutral-50"
            >
              Detect
            </button>
          </div>
        </Field>
        <Field label="Event warning lead (min)" hint="Warn when a high-impact event is this close">
          <NumberInput value={warnMinutes} onChange={setWarnMinutes} ariaLabel="Event warning minutes" />
        </Field>
        <Field label="Experience level">
          <Select
            value={experience}
            onChange={setExperience}
            ariaLabel="Experience level"
            options={[
              { value: "", label: "—" },
              { value: "beginner", label: "Beginner" },
              { value: "intermediate", label: "Intermediate" },
              { value: "advanced", label: "Advanced" },
            ]}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={beginnerMode}
          onChange={(e) => setBeginnerMode(e.target.checked)}
        />
        Beginner explanation mode — show extra plain-language explanations throughout the app
      </label>

      {status && (
        <p
          className={`rounded-md border p-3 text-sm ${
            status.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {status.msg}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save trading profile"}
      </button>
    </div>
  );
}
