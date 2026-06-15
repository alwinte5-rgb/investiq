import { apiFetch } from "@/lib/api";
import { ResearchUI } from "@/components/analysis-ui";
import { MoversList, type MarketMovers, type Mover } from "@/components/movers-ui";
import { DiscoverIdeas, type DiscoveryGroup } from "@/components/discover-ui";

export const dynamic = "force-dynamic"; // personalized — never statically cached

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: { ticker?: string };
}) {
  const initialTicker = (searchParams.ticker ?? "").trim().toUpperCase();

  // Today's movers (with a popular fallback) + grouped ideas across the size/risk
  // spectrum (large/mid/small-cap, dividend, ETFs). All best-effort.
  const [movers, popular, discovery] = await Promise.all([
    apiFetch<MarketMovers>("/api/v1/market/movers").catch(() => null),
    apiFetch<Mover[]>("/api/v1/market/popular").catch(() => [] as Mover[]),
    apiFetch<DiscoveryGroup[]>("/api/v1/discovery").catch(() => [] as DiscoveryGroup[]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Research</h1>
        <p className="text-sm text-neutral-500">
          Search any US stock or ETF for an evidence-grounded AI analysis — or browse ideas below.
        </p>
      </div>
      <ResearchUI initialTicker={initialTicker} />
      <MoversList movers={movers} popular={popular} />
      <DiscoverIdeas groups={discovery} />
    </div>
  );
}
