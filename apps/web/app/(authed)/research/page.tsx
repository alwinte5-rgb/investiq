import { apiFetch } from "@/lib/api";
import { ResearchUI } from "@/components/analysis-ui";
import { MoversList, type MarketMovers } from "@/components/movers-ui";

export const dynamic = "force-dynamic"; // personalized — never statically cached

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: { ticker?: string };
}) {
  const initialTicker = (searchParams.ticker ?? "").trim().toUpperCase();

  // Real top gainers/losers (best-effort — never blocks the page).
  let movers: MarketMovers | null = null;
  try {
    movers = await apiFetch<MarketMovers>("/api/v1/market/movers");
  } catch {
    movers = null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Research</h1>
        <p className="text-sm text-neutral-500">
          Search any US stock or ETF for an evidence-grounded AI analysis — or browse today’s movers.
        </p>
      </div>
      <ResearchUI initialTicker={initialTicker} />
      <MoversList movers={movers} />
    </div>
  );
}
