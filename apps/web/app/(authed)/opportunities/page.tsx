import { apiFetch } from "@/lib/api";
import { OpportunitiesUI } from "@/components/opportunities-ui";
import { DiscoverIdeas, type DiscoveryGroup } from "@/components/discover-ui";
import type { OpportunityGroup } from "@/app/(authed)/opportunities/actions";

export const dynamic = "force-dynamic"; // personalized — never statically cached

export default async function OpportunitiesPage() {
  let initial: OpportunityGroup[] = [];
  let gated = false;

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
        <p className="text-sm text-neutral-500">
          Ranked watches and warnings built from your own analyses, risk and news.
        </p>
      </div>
      <OpportunitiesUI initial={initial} gated={gated} />
      <DiscoverIdeas groups={discovery} />
    </div>
  );
}
