import Link from "next/link";

/**
 * Market movers — today's top gainers/losers from real provider data (Polygon
 * snapshot via the API). Browse-to-analyze: every ticker links into Research,
 * which auto-runs the grounded analysis. Purely presentational; the page fetches.
 */
export interface Mover {
  ticker: string;
  price: number;
  change: number | null;
  changePct: number | null;
}
export interface MarketMovers {
  gainers: Mover[];
  losers: Mover[];
  asOf: string;
}

const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const pct = (n: number | null) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);

function MoverColumn({ title, items }: { title: string; items: Mover[] }) {
  return (
    <section className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-neutral-500">No data right now.</p>
      ) : (
        <ul className="divide-y">
          {items.map((m) => {
            const up = (m.changePct ?? 0) >= 0;
            return (
              <li key={m.ticker}>
                <Link
                  href={`/research?ticker=${m.ticker}`}
                  className="flex items-center justify-between py-1.5 hover:bg-neutral-50"
                  title={`Analyze ${m.ticker}`}
                >
                  <span className="font-medium text-blue-600">{m.ticker}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-neutral-700">{usd(m.price)}</span>
                    <span className={`w-16 text-right text-xs font-medium ${up ? "text-green-600" : "text-red-600"}`}>
                      {pct(m.changePct)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function MoversList({
  movers,
  popular,
}: {
  movers: MarketMovers | null;
  popular?: Mover[];
}) {
  const hasMovers = !!movers && (movers.gainers.length > 0 || movers.losers.length > 0);

  if (hasMovers) {
    return (
      <div className="space-y-2">
        <div>
          <h2 className="text-lg font-semibold">Today’s movers</h2>
          <p className="text-sm text-neutral-500">
            Top US gainers and losers right now — tap any ticker to get a grounded analysis.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <MoverColumn title="📈 Top gainers" items={movers!.gainers} />
          <MoverColumn title="📉 Top losers" items={movers!.losers} />
        </div>
      </div>
    );
  }

  // Fallback: widely-held names with live quotes, so there are always ideas to research.
  if (popular && popular.length > 0) {
    return (
      <div className="space-y-2">
        <div>
          <h2 className="text-lg font-semibold">Popular to research</h2>
          <p className="text-sm text-neutral-500">
            Widely-held US stocks and ETFs — tap any ticker to get a grounded analysis.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <MoverColumn title="Most-followed" items={popular.slice(0, Math.ceil(popular.length / 2))} />
          <MoverColumn title=" " items={popular.slice(Math.ceil(popular.length / 2))} />
        </div>
      </div>
    );
  }

  return (
    <p className="rounded-md border border-dashed p-4 text-center text-sm text-neutral-500">
      Suggestions are unavailable right now. Use the search above to analyze any US stock or ETF.
    </p>
  );
}
