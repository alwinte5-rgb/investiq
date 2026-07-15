import { apiFetch } from "@/lib/api";
import { CalculatorTabs } from "@/components/forex/calculator-tabs";
import type { TradeCalculatorDefaults, TradeCalculatorInitial } from "@/components/forex/trade-calculator";

export const dynamic = "force-dynamic"; // personalized — never statically cached

interface ForexSettings {
  accountCurrency: string;
  defaultAccountBalance: number;
  defaultRiskPercentage: number;
  maximumRiskPercentage: number;
  defaultLeverage: number;
  preferredRewardRatio: number;
  beginnerMode: boolean;
}

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
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
        beginnerMode: Boolean(settings.beginnerMode),
      }
    : undefined;

  // Prefill from the dashboard quick calculator (query-param handoff).
  const s = (k: string) => {
    const v = searchParams?.[k];
    return typeof v === "string" && v !== "" ? v : undefined;
  };
  const initial: TradeCalculatorInitial | undefined = s("pair")
    ? {
        pair: s("pair"),
        direction: s("direction") === "SELL" ? "SELL" : "BUY",
        entry: s("entry"),
        stopPips: s("stopPips"),
        riskPct: s("risk"),
        balance: s("balance"),
        leverage: s("leverage"),
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
      <CalculatorTabs defaults={defaults} initial={initial} />
    </div>
  );
}
