import { apiFetch } from "@/lib/api";
import { PlannerUI } from "@/components/forex/planner-ui";
import type { TradePlanRow } from "./actions";

export const dynamic = "force-dynamic";

interface ForexSettings {
  accountCurrency: string;
  defaultAccountBalance: number;
  defaultRiskPercentage: number;
  defaultLeverage: number;
}

export default async function PlannerPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const [plansRes, settings] = await Promise.all([
    apiFetch<{ plans: TradePlanRow[]; openRisk: number }>("/api/v1/trade-plans").catch(() => ({
      plans: [] as TradePlanRow[],
      openRisk: 0,
    })),
    apiFetch<ForexSettings>("/api/v1/me/forex-settings").catch(() => null),
  ]);

  // Prefill from the Trade Calculator's "Save as Trade Plan" handoff.
  const s = (k: string) => {
    const v = searchParams?.[k];
    return typeof v === "string" ? v : undefined;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Trade Planner</h1>
        <p className="text-sm text-slate-500">
          Write the trade down before you take it. Every plan is checked against your own risk
          settings before it can be saved.
        </p>
      </div>

      <PlannerUI
        initialPlans={plansRes.plans}
        openRisk={plansRes.openRisk}
        accountCurrency={settings?.accountCurrency ?? "USD"}
        defaults={{
          balance: settings ? String(Number(settings.defaultAccountBalance)) : "2000",
          riskPct: settings ? String(Number(settings.defaultRiskPercentage)) : "1",
          leverage: settings ? String(Number(settings.defaultLeverage)) : "50",
        }}
        prefill={{
          pair: s("pair"),
          direction: s("direction") === "SELL" ? "SELL" : s("direction") === "BUY" ? "BUY" : undefined,
          entry: s("entry"),
          stop: s("stop"),
          tp: s("tp"),
          risk: s("risk"),
          balance: s("balance"),
          leverage: s("leverage"),
        }}
      />
    </div>
  );
}
