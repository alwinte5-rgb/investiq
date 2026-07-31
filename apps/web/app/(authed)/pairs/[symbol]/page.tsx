import Link from "next/link";
import { notFound } from "next/navigation";
import { atrMoneyForUnits, directionExplanations, explainRate, findPair } from "@investiq/shared";
import { apiFetch } from "@/lib/api";
import { PairEmbeds } from "@/components/forex/pair-embeds";
import { PairChart } from "@/components/forex/pair-chart";

export const dynamic = "force-dynamic";

interface PairEvent {
  id: string;
  name: string;
  currency: string;
  impact: "LOW" | "MEDIUM" | "HIGH";
  eventTime: string;
}

interface PairInsight {
  rate: number | null;
  rateAsOf: string | null;
  atrPips: number | null;
}

interface ForexSettings {
  accountCurrency: string;
}

/** Currency-pair profile: educational reference + embedded calculators. */
export default async function PairDetailPage({ params }: { params: { symbol: string } }) {
  const info = findPair(params.symbol.replace(/-/g, "/"));
  if (!info) notFound();

  // Typical daily range from the ATR the suggestion engine already computes.
  const [insight, settings] = await Promise.all([
    apiFetch<PairInsight>(`/api/v1/pairs/${info.symbol.replace("/", "-")}/insight?direction=BUY`).catch(
      () => null,
    ),
    apiFetch<ForexSettings>("/api/v1/me/forex-settings").catch(() => null),
  ]);
  const accountCurrency = settings?.accountCurrency ?? "USD";
  const atrMoney =
    insight?.atrPips != null
      ? atrMoneyForUnits({
          pairSymbol: info.symbol,
          atrPips: insight.atrPips,
          units: 1000,
          accountCurrency,
          rates: insight.rate != null ? { [info.symbol]: insight.rate } : {},
        })
      : null;

  // This pair's scheduled releases (both currencies), best-effort.
  const upcoming = await apiFetch<{ events: PairEvent[] }>(
    `/api/v1/calendar/events?currency=${info.baseCurrency}`,
  )
    .then(async (base) => {
      const quote = await apiFetch<{ events: PairEvent[] }>(
        `/api/v1/calendar/events?currency=${info.quoteCurrency}`,
      ).catch(() => ({ events: [] as PairEvent[] }));
      return [...base.events, ...quote.events]
        .sort((a, b) => a.eventTime.localeCompare(b.eventTime))
        .slice(0, 6);
    })
    .catch(() => [] as PairEvent[]);

  const explanations = directionExplanations(info);
  const categoryLabel =
    info.category === "MAJOR" ? "Major pair" : info.category === "MINOR" ? "Minor / cross pair" : "Exotic pair";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold tabular-nums text-t1">{info.symbol}</h1>
          <span className="rounded-full border px-2.5 py-0.5 text-xs text-t3">{categoryLabel}</span>
        </div>
        <p className="text-sm text-t3">{info.displayName}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="text-xs text-t3">Base currency</div>
          <div className="text-lg font-semibold">{info.baseCurrency}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-t3">Quote currency</div>
          <div className="text-lg font-semibold">{info.quoteCurrency}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-t3">Pip size</div>
          <div className="text-lg font-semibold tabular-nums">{info.pipSize}</div>
          <div className="text-[11px] text-t3">Pipette {info.pipetteSize}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-t3">Typical format</div>
          <div className="text-lg font-semibold tabular-nums">
            {info.pipSize === 0.01 ? "3 decimals" : "5 decimals"}
          </div>
        </div>
      </section>

      <section className="space-y-2 rounded-lg border bg-raised p-4 text-sm leading-relaxed text-t2">
        <p>{info.description}</p>
        <p className="text-t3">
          Example: {explainRate(info, insight?.rate ?? (info.pipSize === 0.01 ? 145.25 : 1.085))}
        </p>
      </section>

      {insight?.atrPips != null && (
        <section className="rounded-lg border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-t1">Typical daily range</h2>
            {insight.rateAsOf && (
              <span className="text-[11px] text-t3">
                Updated {new Date(insight.rateAsOf).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-6">
            <div>
              <div className="text-2xl font-bold tabular-nums text-t1">
                ≈ {Math.round(insight.atrPips)} pips
              </div>
              <div className="text-[11px] text-t3">14-day average true range, daily candles</div>
            </div>
            {atrMoney && (
              <div>
                <div className="text-2xl font-bold tabular-nums text-t1">
                  ≈{" "}
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: atrMoney.currency,
                    maximumFractionDigits: 2,
                  }).format(atrMoney.amount)}
                </div>
                <div className="text-[11px] text-t3">
                  movement at 1,000 units{atrMoney.converted ? "" : ` (in ${atrMoney.currency})`}
                </div>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-t3">
            This is a recent average range, not a prediction of today&apos;s movement.
          </p>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold text-t1">What buying means</h2>
          <p className="mt-1 text-sm text-t2">{explanations.buy}</p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold text-t1">What selling means</h2>
          <p className="mt-1 text-sm text-t2">{explanations.sell}</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold text-t1">Most active sessions</h2>
          <ul className="mt-1 space-y-0.5 text-sm text-t2">
            {info.sessions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <Link href="/sessions" className="mt-2 inline-block text-xs text-accent hover:underline">
            View session times →
          </Link>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold text-t1">Central banks</h2>
          <ul className="mt-1 space-y-0.5 text-sm text-t2">
            {info.centralBanks.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-t3">Economies: {info.economies.join(", ")}</p>
          <p className="mt-1 text-xs text-t3">
            Central-bank decisions can affect interest rates, currency demand, and volatility in
            this pair.
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold text-t1">Events traders watch</h2>
          <ul className="mt-1 space-y-0.5 text-sm text-t2">
            {info.commonEvents.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <Link href="/calendar" className="mt-2 inline-block text-xs text-accent hover:underline">
            Economic calendar →
          </Link>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-t1">Risk considerations</h2>
        <div className="flex flex-wrap gap-2">
          {info.educationLabels.map((l) => (
            <span key={l} className="rounded-full border px-3 py-1 text-xs text-t2">
              {l}
            </span>
          ))}
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-t1">Upcoming events for {info.symbol}</h2>
            <Link href="/calendar" className="text-xs text-accent hover:underline">
              Full calendar →
            </Link>
          </div>
          <div className="divide-y rounded-lg border">
            {upcoming.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-2.5 text-sm">
                <span className="w-12 font-medium">{e.currency}</span>
                <span className="flex-1">{e.name}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    e.impact === "HIGH"
                      ? "border-red-200 bg-neg-soft text-red-800"
                      : e.impact === "MEDIUM"
                        ? "border-warn bg-warn-soft text-warn"
                        : "border-edge text-t3"
                  }`}
                >
                  {e.impact === "HIGH" ? "High" : e.impact === "MEDIUM" ? "Medium" : "Low"}
                </span>
                <span className="tabular-nums text-xs text-t3">
                  {new Date(e.eventTime).toLocaleString(undefined, {
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-t1">Live chart</h2>
        <PairChart pairSymbol={info.symbol} height={360} />
      </section>

      <PairEmbeds symbol={info.symbol} />
    </div>
  );
}
