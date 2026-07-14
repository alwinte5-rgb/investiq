import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { apiFetch } from "@/lib/api";
import { SessionsUI } from "@/components/forex/sessions-ui";
import { TradeCalculator } from "@/components/forex/trade-calculator";
import { WatchlistCards, type WatchlistPair } from "@/components/forex/watchlist-cards";
import type { CalendarEvent } from "@/components/forex/calendar-ui";
import { DEFAULT_WATCHLIST_SYMBOLS } from "@investiq/shared";

export const dynamic = "force-dynamic"; // personalized — never statically cached

interface ForexSettings {
  accountCurrency: string;
  defaultAccountBalance: number;
  defaultRiskPercentage: number;
  maximumRiskPercentage: number;
  defaultLeverage: number;
  preferredRewardRatio: number;
  beginnerMode: boolean;
}

interface RatesResult {
  rates: Record<string, number>;
  lastUpdated: string | null;
  stale: boolean;
}

function fmt(v: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

export default async function DashboardPage() {
  const user = await currentUser().catch(() => null);
  const firstName = user?.firstName ?? null;

  // Best-effort parallel loads; each section degrades independently.
  const [settings, saved, plans, calendar, rates] = await Promise.all([
    apiFetch<ForexSettings>("/api/v1/me/forex-settings").catch(() => null),
    apiFetch<{ customized: boolean; pairs: WatchlistPair[] }>("/api/v1/me/saved-pairs").catch(() => null),
    apiFetch<{ plans: unknown[]; openRisk: number }>("/api/v1/trade-plans").catch(() => ({
      plans: [] as unknown[],
      openRisk: 0,
    })),
    apiFetch<{ events: CalendarEvent[]; providerEnabled: boolean }>("/api/v1/calendar/events").catch(() => ({
      events: [] as CalendarEvent[],
      providerEnabled: false,
    })),
    apiFetch<RatesResult>(
      `/api/v1/rates?pairs=${encodeURIComponent(DEFAULT_WATCHLIST_SYMBOLS.join(","))}`,
    ).catch(() => ({ rates: {}, lastUpdated: null, stale: true }) as RatesResult),
  ]);

  const currency = settings?.accountCurrency ?? "USD";
  const balance = settings ? Number(settings.defaultAccountBalance) : null;
  const defaultRisk = settings ? Number(settings.defaultRiskPercentage) : null;
  const maxRisk = settings ? Number(settings.maximumRiskPercentage) : null;
  const defaultRiskAmount = balance != null && defaultRisk != null ? balance * (defaultRisk / 100) : null;
  const maxRiskAmount = balance != null && maxRisk != null ? balance * (maxRisk / 100) : null;
  const openRisk = plans.openRisk ?? 0;
  const remainingAllowance = maxRiskAmount != null ? Math.max(0, maxRiskAmount - openRisk) : null;

  const upcomingEvents = calendar.events.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {firstName ? `Welcome back, ${firstName}` : "Your risk dashboard"}
        </h1>
        <p className="text-sm text-slate-500">
          Know exactly how much you&apos;re controlling and risking before you place the trade.
        </p>
      </div>

      {/* ── Account summary ── */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Account summary</h2>
          <Link href="/settings" className="text-xs text-blue-600 hover:underline">
            Edit settings →
          </Link>
        </div>
        {settings == null ? (
          <p className="rounded-lg border border-dashed p-5 text-sm text-slate-500">
            Set your account balance, currency, and risk limits in{" "}
            <Link href="/settings" className="text-blue-600 hover:underline">
              Settings
            </Link>{" "}
            to unlock personalized risk checks.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              <div className="rounded-lg border p-3">
                <div className="text-[11px] text-slate-400">Account balance</div>
                <div className="text-lg font-semibold tabular-nums">
                  {balance != null ? fmt(balance, currency) : "—"}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-[11px] text-slate-400">Default risk ({defaultRisk}%)</div>
                <div className="text-lg font-semibold tabular-nums">
                  {defaultRiskAmount != null ? fmt(defaultRiskAmount, currency) : "—"}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-[11px] text-slate-400">Maximum risk ({maxRisk}%)</div>
                <div className="text-lg font-semibold tabular-nums">
                  {maxRiskAmount != null ? fmt(maxRiskAmount, currency) : "—"}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-[11px] text-slate-400">Broker leverage</div>
                <div className="text-lg font-semibold tabular-nums">{Number(settings.defaultLeverage)}:1</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-[11px] text-slate-400">Open planned risk</div>
                <div className="text-lg font-semibold tabular-nums">{fmt(openRisk, currency)}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-[11px] text-slate-400">Remaining risk allowance</div>
                <div className="text-lg font-semibold tabular-nums">
                  {remainingAllowance != null ? fmt(remainingAllowance, currency) : "—"}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Your margin requirement is not the same as the amount you could lose — risk is set by
              your stop loss; margin is only what your broker reserves.
            </p>
          </>
        )}
      </section>

      {/* ── Quick calculator ── */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Quick calculator</h2>
        <div className="rounded-lg border p-4">
          <TradeCalculator
            compact
            defaults={
              settings
                ? {
                    accountBalance: balance ?? undefined,
                    accountCurrency: currency,
                    defaultRiskPct: defaultRisk ?? undefined,
                    maxRiskPct: maxRisk ?? undefined,
                    leverage: Number(settings.defaultLeverage),
                    preferredRewardRatio: Number(settings.preferredRewardRatio),
                  }
                : undefined
            }
          />
        </div>
      </section>

      {/* ── Watchlist ── */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Currency pairs</h2>
          <Link href="/pairs" className="text-xs text-blue-600 hover:underline">
            All pairs →
          </Link>
        </div>
        <WatchlistCards pairs={saved?.pairs ?? []} rates={rates.rates} lastUpdated={rates.lastUpdated} />
      </section>

      {/* ── Market sessions ── */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Market sessions</h2>
          <Link href="/sessions" className="text-xs text-blue-600 hover:underline">
            Details →
          </Link>
        </div>
        <SessionsUI compact />
      </section>

      {/* ── Upcoming events ── */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Upcoming economic events</h2>
          <Link href="/calendar" className="text-xs text-blue-600 hover:underline">
            Full calendar →
          </Link>
        </div>
        {upcomingEvents.length === 0 ? (
          <p className="rounded-lg border border-dashed p-5 text-sm text-slate-500">
            {calendar.providerEnabled
              ? "No events in the next two weeks."
              : "No calendar provider connected yet — once configured, upcoming high-impact releases will appear here and inside your trade checks."}
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {upcomingEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-3 text-sm">
                <span className="w-14 font-medium">{e.currency}</span>
                <span className="flex-1">{e.name}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    e.impact === "HIGH"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : e.impact === "MEDIUM"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-slate-200 text-slate-500"
                  }`}
                >
                  {e.impact === "HIGH" ? "High" : e.impact === "MEDIUM" ? "Medium" : "Low"}
                </span>
                <span className="tabular-nums text-xs text-slate-500">
                  {new Date(e.eventTime).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
