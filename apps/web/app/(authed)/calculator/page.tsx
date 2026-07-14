import { apiFetch } from "@/lib/api";
import { CalculatorTabs } from "@/components/forex/calculator-tabs";
import type { TradeCalculatorDefaults } from "@/components/forex/trade-calculator";

export const dynamic = "force-dynamic"; // personalized — never statically cached

interface ForexSettings {
  accountCurrency: string;
  defaultAccountBalance: number;
  defaultRiskPercentage: number;
  maximumRiskPercentage: number;
  defaultLeverage: number;
  preferredRewardRatio: number;
}

export default async function CalculatorPage() {
  // Best-effort: the calculator works with built-in defaults if settings fail.
  const settings = await apiFetch<ForexSettings>("/api/v1/me/forex-settings").catch(() => null);
  const defaults: TradeCalculatorDefaults | undefined = settings
    ? {
        accountBalance: Number(settings.defaultAccountBalance),
        accountCurrency: settings.accountCurrency,
        defaultRiskPct: Number(settings.defaultRiskPercentage),
        maxRiskPct: Number(settings.maximumRiskPercentage),
        leverage: Number(settings.defaultLeverage),
        preferredRewardRatio: Number(settings.preferredRewardRatio),
      }
    : undefined;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Trade Calculator</h1>
        <p className="text-sm text-slate-500">
          Know exactly how much you are controlling and risking before you place the trade. Status
          checks compare each setup against your own risk settings.
        </p>
      </div>
      <CalculatorTabs defaults={defaults} />
    </div>
  );
}
