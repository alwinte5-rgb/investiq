import Link from "next/link";

/**
 * Discovery — screened "ideas to research" from the FMP company screener. These
 * are factual screen results (real listed stocks matching transparent criteria),
 * NOT AI recommendations or "Watch" signals. Each links into Research to analyze.
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

const usd = (n: number | null) => (n == null ? "—" : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
function marketCap(n: number | null): string {
  if (n == null) return "";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(0)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n}`;
}

export function DiscoverIdeas({ groups }: { groups: DiscoveryGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Ideas to research</h2>
        <p className="text-sm text-neutral-500">
          Stocks matching simple, factual screens — starting points, not recommendations. Tap any to
          run a full analysis.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {groups.map((g) => (
          <section key={g.key} className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold">{g.title}</h3>
            <p className="mb-2 text-[11px] text-neutral-500">{g.blurb}</p>
            <ul className="divide-y">
              {g.items.map((s) => (
                <li key={s.ticker}>
                  <Link
                    href={`/research?ticker=${s.ticker}`}
                    className="flex items-center justify-between gap-2 py-1.5 hover:bg-neutral-50"
                    title={`Analyze ${s.ticker}`}
                  >
                    <span className="min-w-0">
                      <span className="font-medium text-blue-600">{s.ticker}</span>{" "}
                      <span className="truncate text-xs text-neutral-500">{s.name}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-neutral-500">
                      <span className="text-neutral-700">{usd(s.price)}</span>
                      {s.marketCap != null && <span className="ml-2">{marketCap(s.marketCap)}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="text-[11px] text-neutral-400">
        Screen results from public market data — educational, not investment advice.
      </p>
    </div>
  );
}
