import { apiFetch } from "@/lib/api";
import { JournalUI, type JournalPrefill } from "@/components/forex/journal-ui";
import type { JournalAnalytics, JournalRow } from "./actions";

export const dynamic = "force-dynamic";

interface ForexSettings {
  accountCurrency: string;
}

interface PlanForJournal {
  id: string;
  direction: "BUY" | "SELL";
  entryPrice: string;
  stopLossPrice: string | null;
  takeProfitPrice: string | null;
  positionUnits: number | null;
  riskAmount: string | null;
  strategyTag: string | null;
  session: string | null;
  reasoning: string | null;
  pair: { symbol: string };
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const [entries, analytics, settings] = await Promise.all([
    apiFetch<JournalRow[]>("/api/v1/journal").catch(() => [] as JournalRow[]),
    apiFetch<JournalAnalytics>("/api/v1/journal/analytics").catch(() => null),
    apiFetch<ForexSettings>("/api/v1/me/forex-settings").catch(() => null),
  ]);

  // "Journal This Trade" handoff: ?fromPlan=<id> prefills the form from the
  // plan's stored values (planned side) and links the entry to the plan.
  const fromPlanId = typeof searchParams?.fromPlan === "string" ? searchParams.fromPlan : undefined;
  let prefill: JournalPrefill | undefined;
  if (fromPlanId && !entries.some((e) => e.tradePlanId === fromPlanId)) {
    const plansRes = await apiFetch<{ plans: PlanForJournal[] }>("/api/v1/trade-plans").catch(() => null);
    const plan = plansRes?.plans.find((p) => p.id === fromPlanId);
    if (plan) {
      prefill = {
        tradePlanId: plan.id,
        pairSymbol: plan.pair.symbol,
        direction: plan.direction,
        plannedEntry: plan.entryPrice ? String(Number(plan.entryPrice)) : undefined,
        plannedStop: plan.stopLossPrice ? String(Number(plan.stopLossPrice)) : undefined,
        plannedTarget: plan.takeProfitPrice ? String(Number(plan.takeProfitPrice)) : undefined,
        plannedUnits: plan.positionUnits != null ? String(plan.positionUnits) : undefined,
        plannedRisk: plan.riskAmount ? String(Number(plan.riskAmount)) : undefined,
        strategyTag: plan.strategyTag ?? undefined,
        session: plan.session ?? undefined,
        notes: plan.reasoning ?? undefined,
      };
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Trading Journal</h1>
        <p className="text-sm text-slate-500">
          Record what actually happened — planned values are optional and prefill automatically when
          you journal a trade plan. Over time, the analytics surface patterns about your process.
        </p>
      </div>

      {fromPlanId && !prefill && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          That trade plan has already been journaled (or wasn&apos;t found) — its entry is in the
          list below.
        </p>
      )}

      <JournalUI
        initialEntries={entries}
        initialAnalytics={analytics}
        accountCurrency={settings?.accountCurrency ?? "USD"}
        prefill={prefill}
      />
    </div>
  );
}
