import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { PlatformPage } from "@/components/trading/platform-page";
import { Panel, SectionLink } from "@/components/trading/ui";
import { QuickCalculator } from "@/components/forex/quick-calculator";
import { WatchlistCards, type WatchlistPair } from "@/components/forex/watchlist-cards";
import type { CalendarEvent } from "@/components/forex/calendar-ui";
import { DEFAULT_WATCHLIST_SYMBOLS } from "@investiq/shared";

export const dynamic = "force-dynamic";

interface RatesResult {
  rates: Record<string, number>;
  lastUpdated: string | null;
  stale: boolean;
}

interface ForexSettings {
  accountCurrency: string;
  defaultAccountBalance: number;
  defaultRiskPercentage: number;
  defaultLeverage: number;
}

/** Forex hub: the AUDCAD bot (via the platform scaffold) + the forex tooling
 * that used to live on the old dashboard — watchlist, quick calculator,
 * calendar preview, links into planner/journal. */
export default async function ForexPage() {
  const [settings, saved, calendar, rates] = await Promise.all([
    apiFetch<ForexSettings>("/api/v1/me/forex-settings").catch(() => null),
    apiFetch<{ customized: boolean; pairs: WatchlistPair[] }>("/api/v1/me/saved-pairs").catch(
      () => null,
    ),
    apiFetch<{ events: CalendarEvent[]; providerEnabled: boolean }>(
      "/api/v1/calendar/events",
    ).catch(() => ({ events: [] as CalendarEvent[], providerEnabled: false })),
    apiFetch<RatesResult>(
      `/api/v1/rates?pairs=${encodeURIComponent(DEFAULT_WATCHLIST_SYMBOLS.join(","))}`,
    ).catch(() => ({ rates: {}, lastUpdated: null, stale: true }) as RatesResult),
  ]);

  const upcoming = calendar.events.slice(0, 5);

  return (
    <PlatformPage
      assetClass="forex"
      title="Forex"
      note="pairs, sessions, planner & journal live in Tools"
      extra={
        <div className="space-y-5">
          <Panel title="Watchlist" action={<SectionLink href="/pairs">All pairs →</SectionLink>}>
            <WatchlistCards
              pairs={saved?.pairs ?? []}
              rates={rates.rates}
              lastUpdated={rates.lastUpdated}
            />
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title="Quick check"
              action={<SectionLink href="/calculator">Full calculator →</SectionLink>}
            >
              <QuickCalculator
                balance={settings ? Number(settings.defaultAccountBalance) : 1000}
                currency={settings?.accountCurrency ?? "USD"}
                defaultRiskPct={settings ? Number(settings.defaultRiskPercentage) : 1}
                leverage={settings ? Number(settings.defaultLeverage) : 50}
                rates={rates.rates}
              />
            </Panel>
            <Panel
              title="Upcoming events"
              action={<SectionLink href="/calendar">Calendar →</SectionLink>}
            >
              {upcoming.length ? (
                <ul className="space-y-2 text-sm">
                  {upcoming.map((e, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-t2">
                        <span className="mr-2 font-medium text-t1">{e.currency}</span>
                        {e.name}
                      </span>
                      <span className="shrink-0 text-xs text-t3">
                        {new Date(e.eventTime).toLocaleString(undefined, {
                          weekday: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-center text-sm text-t3">No upcoming events loaded.</p>
              )}
            </Panel>
          </div>

          <p className="text-xs text-t3">
            Plan a trade in the{" "}
            <Link href="/planner" className="text-accent hover:underline">
              Planner
            </Link>{" "}
            · review results in the{" "}
            <Link href="/journal" className="text-accent hover:underline">
              Journal
            </Link>
            .
          </p>
        </div>
      }
    />
  );
}
