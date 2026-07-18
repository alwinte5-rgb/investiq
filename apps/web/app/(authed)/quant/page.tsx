import { QuantLabDashboard, loadQuantStatus } from "@/components/quant-lab";

export const dynamic = "force-dynamic";

// Quant Lab — read-only window into the local ~/quant-lab RBI pipeline
// (Research → Backtest → Incubate). Educational: shows the process of
// strategy testing and honest failure rates; nothing here places trades.
export default async function QuantPage() {
  const status = await loadQuantStatus();
  return <QuantLabDashboard status={status} />;
}
