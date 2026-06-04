import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  ConnectButton,
  DemoButton,
  DisconnectButton,
  ReconnectButton,
  RemoveDemoButton,
  SyncButton,
} from "./portfolio-controls";

export const dynamic = "force-dynamic"; // personalized — never statically cached

interface Me {
  userId: string;
  plan: "FREE" | "INVESTOR" | "INVESTOR_PLUS";
  role: "USER" | "ADMIN";
}
interface Summary {
  accounts: number;
  positions: number;
  totalValue: number;
  cash: number;
  connected: boolean;
}
interface Connection {
  id: string;
  brokerageName: string | null;
  status: string;
  lastSyncedAt: string | null;
}
interface Holding {
  id: string;
  quantity: string | number;
  marketValue: string | number | null;
  symbol: { ticker: string; name: string; assetType: string };
}
interface Account {
  id: string;
  name: string | null;
  currency: string;
  totalValue: string | number;
  holdings: Holding[];
}

const money = (v: number | string | null) =>
  v == null ? "—" : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

async function safe<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path);
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  let me: Me | null = null;
  let error: string | null = null;
  try {
    me = await apiFetch<Me>("/api/v1/me");
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load";
  }

  const [summary, connections, accounts] = await Promise.all([
    safe<Summary>("/api/v1/portfolio/summary"),
    safe<Connection[]>("/api/v1/connections"),
    safe<Account[]>("/api/v1/accounts"),
  ]);
  const connection = connections?.[0];
  const isDemo = connection?.status === "demo";
  const isDisabled = connection?.status === "disabled";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load your account: {error}
        </div>
      ) : me ? (
        <div className="rounded-md border p-4 text-sm">
          <div className="flex justify-between border-b py-2">
            <span className="text-neutral-500">Plan</span>
            <span className="font-medium">{me.plan}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-neutral-500">Role</span>
            <span className="font-medium">{me.role}</span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-neutral-500">Loading…</div>
      )}

      {/* Portfolio */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            Portfolio
            {isDemo && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                Sample data
              </span>
            )}
          </h2>
          {connection &&
            (isDemo ? (
              <RemoveDemoButton connectionId={connection.id} />
            ) : isDisabled ? (
              <span className="flex items-center gap-2">
                <ReconnectButton />
                <DisconnectButton connectionId={connection.id} />
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <SyncButton connectionId={connection.id} />
                <DisconnectButton connectionId={connection.id} />
              </span>
            ))}
        </div>

        {isDisabled && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This brokerage connection has expired (the broker dropped the authorization). The
            holdings below may be stale — <strong>Reconnect</strong> to resume syncing, or{" "}
            <strong>Disconnect</strong> to remove it.
          </div>
        )}

        {!summary || !summary.connected ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-neutral-600">
            <p className="mb-3">Connect a brokerage to see your holdings and a health score.</p>
            <div className="flex flex-col items-center gap-2">
              <ConnectButton />
              <span className="text-xs text-neutral-400">or explore first</span>
              <DemoButton />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Total value", money(summary.totalValue)],
                ["Cash", money(summary.cash)],
                ["Positions", String(summary.positions)],
              ].map(([label, val]) => (
                <div key={label} className="rounded-md border p-3">
                  <div className="text-xs text-neutral-500">{label}</div>
                  <div className="text-lg font-semibold">{val}</div>
                </div>
              ))}
            </div>

            {accounts?.map((a) => (
              <div key={a.id} className="rounded-md border p-4">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium">{a.name ?? "Account"}</span>
                  <span className="text-neutral-500">{money(a.totalValue)}</span>
                </div>
                {a.holdings.length === 0 ? (
                  <p className="text-xs text-neutral-500">No holdings synced yet.</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {a.holdings.map((h) => (
                      <li key={h.id} className="flex items-center justify-between py-1.5">
                        <span>
                          <Link
                            href={`/research?ticker=${h.symbol.ticker}`}
                            className="font-medium text-blue-600 hover:underline"
                            title={`Analyze ${h.symbol.ticker}`}
                          >
                            {h.symbol.ticker}
                          </Link>{" "}
                          <span className="text-neutral-500">× {Number(h.quantity)}</span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span>{money(h.marketValue)}</span>
                          <Link
                            href={`/research?ticker=${h.symbol.ticker}`}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Analyze →
                          </Link>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </>
        )}
      </section>

      <p className="text-xs text-neutral-400">
        <Link href="/watchlists" className="hover:underline">
          Manage watchlists →
        </Link>
      </p>
    </div>
  );
}
