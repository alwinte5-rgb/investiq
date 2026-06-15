import { apiFetch } from "@/lib/api";
import { ResearchUI } from "@/components/analysis-ui";
import { MoversList, type MarketMovers, type Mover } from "@/components/movers-ui";

export const dynamic = "force-dynamic"; // personalized — never statically cached

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: { ticker?: string };
}) {
  const initialTicker = (searchParams.ticker ?? "").trim().toUpperCase();

  // Today's movers, with a curated popular-stocks fallback so there are ALWAYS
  // suggestions (movers can be empty on some data plans). Both best-effort.
  const [movers, popular] = await Promise.all([
    apiFetch<MarketMovers>("/api/v1/market/movers").catch(() => null),
    apiFetch<Mover[]>("/api/v1/market/popular").catch(() => [] as Mover[]),
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
    </div>
  );
}
