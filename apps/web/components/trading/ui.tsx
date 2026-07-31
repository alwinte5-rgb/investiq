import Link from "next/link";
import type { ReactNode } from "react";

/** Shared presentation primitives for the trading pages — one visual system:
 * surface panels, stat tiles, pills, signed P&L (sign + color, never color
 * alone), asset-class badges. */

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-edge bg-surface ${className}`}>
      {title ? (
        <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
          <h2 className="text-sm font-semibold text-t1">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "pos" | "neg" | "warn";
}) {
  const toneClass =
    tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : tone === "warn" ? "text-warn" : "text-t1";
  return (
    <div className="rounded-lg border border-edge bg-surface px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-t3">{label}</p>
      <p className={`tabular mt-1 text-xl font-semibold ${toneClass}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-t3">{sub}</p> : null}
    </div>
  );
}

/** Signed P&L: always renders an explicit +/− so color is never the only
 * encoding. `pct` appends %. */
export function Pnl({ value, pct = false }: { value: number | null | undefined; pct?: boolean }) {
  if (value == null || Number.isNaN(value)) return <span className="text-t3">—</span>;
  const cls = value > 0 ? "text-pos" : value < 0 ? "text-neg" : "text-t2";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`tabular ${cls}`}>
      {sign}
      {value.toFixed(2)}
      {pct ? "%" : ""}
    </span>
  );
}

const CLASS_STYLES: Record<string, string> = {
  stocks: "bg-accent-soft text-accent",
  crypto: "bg-warn-soft text-warn",
  forex: "bg-pos-soft text-pos",
  futures: "bg-raised text-t2",
  options: "bg-neg-soft text-neg",
};

export function ClassBadge({ assetClass }: { assetClass: string }) {
  const cls = CLASS_STYLES[assetClass] ?? "bg-raised text-t2";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {assetClass}
    </span>
  );
}

export function Pill({
  tone,
  children,
}: {
  tone: "pos" | "neg" | "warn" | "muted" | "accent";
  children: ReactNode;
}) {
  const map = {
    pos: "bg-pos-soft text-pos",
    neg: "bg-neg-soft text-neg",
    warn: "bg-warn-soft text-warn",
    muted: "bg-raised text-t2",
    accent: "bg-accent-soft text-accent",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-t3">{children}</p>;
}

export function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-xs font-medium text-accent hover:underline">
      {children}
    </Link>
  );
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtMoney(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
