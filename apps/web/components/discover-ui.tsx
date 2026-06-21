import Link from "next/link";

/**
 * Discovery — "ideas to research" grouped by sector from the app's symbol
 * universe. These are factual starting points (real listed stocks/ETFs), NOT AI
 * recommendations or "Watch" signals. Each links into Research to analyze. No
 * live price/market-cap is shown here (those come from the analysis itself) — so
 * the list never displays empty "—" placeholders or stale numbers.
 */
export interface ScreenedStock {
  ticker: string;
  name: string;
  sector: string | null;
  marketCap: number | null;
  price: number | null;
  beta: number | null;
  assetType: "STOCK" | "ETF";
}
export interface DiscoveryGroup {
  key: string;
  title: string;
  blurb: string;
  items: ScreenedStock[];
}

export function DiscoverIdeas({ groups }: { groups: DiscoveryGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Ideas to research</h2>
        <p className="text-sm text-slate-500">
          Browse by sector — starting points, not recommendations. Tap any ticker to run a full
          analysis.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {groups.map((g) => (
          <section key={g.key} className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold">{g.title}</h3>
            <p className="mb-2 text-[11px] text-slate-500">{g.blurb}</p>
            <ul className="divide-y">
              {g.items.map((s) => (
                <li key={s.ticker}>
                  <Link
                    href={`/research?ticker=${s.ticker}`}
                    className="group flex items-center justify-between gap-2 py-1.5 hover:bg-slate-50"
                    title={`Analyze ${s.ticker}`}
                  >
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span className="font-medium text-blue-600">{s.ticker}</span>
                      <span className="truncate text-xs text-slate-500">{s.name}</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-slate-400 group-hover:text-blue-600">
                      Analyze →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">
        Screen results from public market data — educational, not investment advice.
      </p>
    </div>
  );
}
