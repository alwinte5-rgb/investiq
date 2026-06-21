import { apiFetch } from "@/lib/api";
import { OpportunitiesUI, MarketWatches } from "@/components/opportunities-ui";
import { DiscoverIdeas, type DiscoveryGroup } from "@/components/discover-ui";
import type { OpportunityGroup } from "@/app/(authed)/opportunities/actions";

export const dynamic = "force-dynamic"; // personalized — never statically cached

export default async function OpportunitiesPage() {
  let initial: OpportunityGroup[] = [];
  let gated = false;

  // AI-surfaced market watches (global, non-personalized) + the user's personal
  // opportunities. The market list is best-effort and never blocks the page.
  const market = await apiFetch<OpportunityGroup[]>("/api/v1/opportunities/market").catch(
    () => [] as OpportunityGroup[],
  );

  try {
    initial = await apiFetch<OpportunityGroup[]>("/api/v1/opportunities");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/\b403\b|investor plan|forbidden/i.test(msg)) gated = true;
  }
  // Auto-build from the user's stored analyses when nothing is cached yet — the
  // page should just show results, not require a manual "Generate" click.
  // (Generation is deterministic over stored data: no AI/market calls.)
  if (!gated && initial.length === 0) {
    try {
      initial = await apiFetch<OpportunityGroup[]>("/api/v1/opportunities", { method: "POST" });
    } catch {
      /* leave empty — the UI shows the "run some analyses first" guidance */
    }
  }

  // Screened "ideas to research" — best-effort, never blocks the page.
  let discovery: DiscoveryGroup[] = [];
  try {
    discovery = await apiFetch<DiscoveryGroup[]>("/api/v1/discovery");
  } catch {
    discovery = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Opportunities</h1>
        <p className="text-sm text-slate-500">
          AI-surfaced market watches plus ranked signals from your own analyses — educational, not
          advice.
        </p>
      </div>
      <MarketWatches groups={market} />
      <div className="space-y-3 border-t pt-6">
        <h2 className="text-lg font-semibold">From your analyses</h2>
        <OpportunitiesUI initial={initial} gated={gated} />
      </div>
      <DiscoverIdeas groups={discovery} />
    </div>
  );
}
