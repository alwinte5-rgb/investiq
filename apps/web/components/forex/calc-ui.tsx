"use client";

import { CURRENCY_PAIRS, ACCOUNT_CURRENCIES, RISK_STATUS_LABELS, type RiskStatus } from "@investiq/shared/forex";

/**
 * Shared primitives for the forex calculators — labeled inputs, selects,
 * result rows, and the risk-status badge. Pure UI; every number comes from the
 * shared calculation engine. Color is always paired with a text label.
 */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  step,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  step?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step ?? "any"}
      min="0"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border px-3 py-2 text-sm tabular-nums focus:border-blue-500 focus:outline-none"
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function PairSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const groups: { label: string; category: string }[] = [
    { label: "Majors", category: "MAJOR" },
    { label: "Minors / crosses", category: "MINOR" },
    { label: "Exotics", category: "EXOTIC" },
  ];
  return (
    <select
      value={value}
      aria-label="Currency pair"
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
    >
      {groups.map((g) => (
        <optgroup key={g.category} label={g.label}>
          {CURRENCY_PAIRS.filter((p) => p.category === g.category).map((p) => (
            <option key={p.symbol} value={p.symbol}>
              {p.symbol} — {p.displayName}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function CurrencySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select
      value={value}
      onChange={onChange}
      ariaLabel="Account currency"
      options={ACCOUNT_CURRENCIES.map((c) => ({ value: c, label: c }))}
    />
  );
}

export function DirectionToggle({
  value,
  onChange,
}: {
  value: "BUY" | "SELL";
  onChange: (v: "BUY" | "SELL") => void;
}) {
  return (
    <div role="radiogroup" aria-label="Trade direction" className="grid grid-cols-2 gap-1 rounded-md border p-1">
      {(["BUY", "SELL"] as const).map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={value === d}
          onClick={() => onChange(d)}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            value === d ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {d === "BUY" ? "Buy (long)" : "Sell (short)"}
        </button>
      ))}
    </div>
  );
}

export function ResultRow({
  label,
  value,
  sub,
  emphasize,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right">
        <span className={`tabular-nums ${emphasize ? "text-base font-semibold text-slate-900" : "text-sm font-medium text-slate-800"}`}>
          {value}
        </span>
        {sub && <span className="block text-[11px] text-slate-400">{sub}</span>}
      </span>
    </div>
  );
}

const STATUS_STYLES: Record<RiskStatus, string> = {
  WITHIN_PLAN: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CAUTION: "border-amber-200 bg-amber-50 text-amber-800",
  OUTSIDE_PLAN: "border-red-200 bg-red-50 text-red-800",
  MISSING_INFO: "border-slate-200 bg-slate-50 text-slate-600",
};

export function RiskStatusBadge({ status, reasons }: { status: RiskStatus; reasons: string[] }) {
  return (
    <div className={`rounded-md border p-3 ${STATUS_STYLES[status]}`} role="status">
      <div className="text-sm font-semibold">{RISK_STATUS_LABELS[status]}</div>
      {reasons.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs">
          {reasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      {warnings.map((w) => (
        <li key={w}>⚠ {w}</li>
      ))}
    </ul>
  );
}

/** Parse a form string into a positive number or null. */
export function num(v: string): number | null {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

export function money(v: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}
