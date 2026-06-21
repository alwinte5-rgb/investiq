import { apiFetch } from "@/lib/api";
import { PaperUI } from "@/components/paper-ui";
import type { PaperAccount, PaperOrder, EquityPoint } from "@/app/(authed)/paper/actions";

export const dynamic = "force-dynamic"; // personalized — never statically cached

export default async function PaperPage() {
  let account: PaperAccount | null = null;
  let orders: PaperOrder[] = [];
  let points: EquityPoint[] = [];

  // Best-effort initial load; the client component reloads and shows errors.
  try {
    [account, orders, points] = await Promise.all([
      apiFetch<PaperAccount>("/api/v1/paper/account"),
      apiFetch<PaperOrder[]>("/api/v1/paper/orders"),
      apiFetch<EquityPoint[]>("/api/v1/paper/performance"),
    ]);
  } catch {
    // fall through — the client renders an error/empty state and a retry path
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paper Trading</h1>
        <p className="text-sm text-slate-500">
          A risk-free simulator with $100,000 in virtual cash. Orders fill at live quotes — no real
          money, no brokerage. For learning only.
        </p>
      </div>
      <PaperUI initialAccount={account} initialOrders={orders} initialPoints={points} />
    </div>
  );
}
