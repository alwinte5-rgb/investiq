import { apiFetch } from "@/lib/api";
import { CalendarUI, type CalendarEvent } from "@/components/forex/calendar-ui";

export const dynamic = "force-dynamic";

interface CalendarResponse {
  events: CalendarEvent[];
  providerEnabled: boolean;
}

interface SavedPairsResponse {
  pairs: { symbol: string; baseCurrency: string; quoteCurrency: string }[];
}
interface PlansResponse {
  plans: { id: string; status: string; pair: { symbol: string } }[];
}

export default async function CalendarPage() {
  let initial: CalendarResponse = { events: [], providerEnabled: false };
  let error: string | null = null;
  try {
    initial = await apiFetch<CalendarResponse>("/api/v1/calendar/events");
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load the calendar";
  }

  // Personal context for the event drawer: which of MY pairs/plans an event touches.
  const [saved, plans] = await Promise.all([
    apiFetch<SavedPairsResponse>("/api/v1/me/saved-pairs").catch(() => ({ pairs: [] })),
    apiFetch<PlansResponse>("/api/v1/trade-plans").catch(() => ({ plans: [] })),
  ]);
  const savedPairSymbols = saved.pairs.map((p) => p.symbol);
  const openPlans = plans.plans
    .filter((p) => ["DRAFT", "PLANNED", "ENTERED"].includes(p.status))
    .map((p) => ({ pairSymbol: p.pair.symbol, status: p.status }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Economic Calendar</h1>
        <p className="text-sm text-slate-500">
          Scheduled releases that can move currencies. Around high-impact events, volatility and
          spreads may increase. Awareness only — never a trade signal.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load the calendar: {error}
        </p>
      ) : (
        <CalendarUI
          initial={initial.events}
          providerEnabled={initial.providerEnabled}
          savedPairSymbols={savedPairSymbols}
          openPlans={openPlans}
        />
      )}
    </div>
  );
}
