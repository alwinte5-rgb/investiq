import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { apiFetch } from "@/lib/api";
import { OnboardingGuide } from "@/components/onboarding";
import { ReviewsUI } from "@/components/reviews-ui";
import type { GenerateReviewResult, StoredReview } from "@/app/(authed)/reviews/actions";
import {
  AutoSync,
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
interface MarketIndex {
  ticker: string;
  price: number;
  changePct: number | null;
}
interface MarketOverview {
  indices: MarketIndex[];
  asOf: string;
}
const INDEX_LABELS: Record<string, string> = {
  SPY: "S&P 500",
  QQQ: "Nasdaq 100",
  DIA: "Dow Jones",
  IWM: "Russell 2000",
};
const money = (v: number | string | null) =>
  v == null ? "—" : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

async function safe<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path);
  } catch {
    return null;
  }
}

function Chip({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string;
  href?: string;
  tone?: string | null;
}) {
  const toneClass =
    tone === "Bullish" ? "text-green-600" : tone === "Bearish" ? "text-red-600" : "text-neutral-900";
  const cls = `block rounded-lg border p-3${href ? " transition hover:border-blue-300 hover:bg-blue-50/40" : ""}`;
  const body = (
    <>
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className={`text-lg font-bold ${toneClass}`}>{value}</div>
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
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
  // Brand-new = connections fetched successfully and there are none (real or
  // demo). A failed fetch (null) is NOT treated as new — never greet over an error.
  const isNewUser = connections !== null && connections.length === 0;

  // Today's briefing — the dashboard (Home) is now the single home for reviews.
  // Fetch the stored review (generate today's on the fly if none) and hand it to
  // the full ReviewsUI below. reviewGated mirrors the reviews entitlement.
  let reviewInitial: StoredReview | null = null;
  let reviewGated = false;
  if (summary?.connected) {
    try {
      reviewInitial = await apiFetch<StoredReview | null>("/api/v1/portfolio/reviews");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/\b403\b|investor plan|forbidden/i.test(msg)) reviewGated = true;
    }
    if (!reviewGated && !reviewInitial) {
      try {
        const gen = await apiFetch<GenerateReviewResult>(
          "/api/v1/portfolio/reviews?period=MORNING",
          { method: "POST" },
        );
        if (gen.status === "created" || gen.status === "exists") reviewInitial = gen.review;
      } catch {
        /* best-effort */
      }
    }
  }
  const reviewContent = reviewInitial?.content ?? null;

  // Market overview + at-a-glance counts (all best-effort).
  const [overview, oppGroups, clerkUser] = await Promise.all([
    safe<MarketOverview>("/api/v1/market/overview"),
    safe<{ items: unknown[] }[]>("/api/v1/opportunities"),
    currentUser().catch(() => null),
  ]);
  const firstName = clerkUser?.firstName ?? null;
  const indices = overview?.indices ?? [];
  const avgChg = indices.length
    ? indices.reduce((s, i) => s + (i.changePct ?? 0), 0) / indices.length
    : 0;
  const sentiment = indices.length === 0 ? null : avgChg > 0.3 ? "Bullish" : avgChg < -0.3 ? "Bearish" : "Mixed";
  const oppCount = oppGroups?.reduce((n, g) => n + g.items.length, 0) ?? 0;
  const riskAlerts = reviewContent?.flags.filter((f) => f.severity === "warn").length ?? 0;
  const earningsAhead =
    reviewContent?.flags
      .filter((f) => f.type === "earnings")
      .reduce((n, f) => n + (f.tickers?.length ?? 0), 0) ?? 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const isDemo = connection?.status === "demo";
  const isDisabled = connection?.status === "disabled";
  // A real, non-disabled connection with no holdings yet should pull on load
  // (e.g. right after connecting) instead of making the user hit Sync.
  const autoSyncable = Boolean(connection) && !isDemo && !isDisabled;

  const connectPrompt = (
    <div className="rounded-md border border-dashed p-6 text-center text-sm text-neutral-600">
      <p className="mb-3">Connect a brokerage to see your holdings and a health score.</p>
      <div className="flex flex-col items-center gap-2">
        <ConnectButton />
        <span className="text-xs text-neutral-400">or explore first</span>
        <DemoButton />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm text-neutral-500">Your daily overview</p>
      </div>

      <OnboardingGuide isNewUser={isNewUser} />

      {/* At-a-glance chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Chip label="Market sentiment" value={sentiment ?? "—"} tone={sentiment} />
        <Chip label="Opportunities" value={String(oppCount)} href="/opportunities" />
        <Chip label="Risk alerts" value={String(riskAlerts)} />
        <Chip label="Earnings ahead" value={String(earningsAhead)} />
      </div>

      {/* Market overview */}
      {indices.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Market overview</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {indices.map((i) => (
              <div key={i.ticker} className="rounded-md border p-3">
                <div className="text-xs text-neutral-500">{INDEX_LABELS[i.ticker] ?? i.ticker}</div>
                <div className="text-base font-semibold">{money(i.price)}</div>
                <div
                  className={`text-xs font-medium ${
                    (i.changePct ?? 0) >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {i.changePct == null
                    ? "—"
                    : `${i.changePct >= 0 ? "+" : ""}${i.changePct.toFixed(2)}%`}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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

      {/* Today's briefing — the full review now lives on Home (Reviews page removed). */}
      {summary?.connected && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Today’s briefing</h2>
          <ReviewsUI initial={reviewInitial} gated={reviewGated} />
        </section>
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
                <SyncButton connectionId={connection.id} />
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
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p>
              This brokerage connection has expired (the broker dropped the authorization), so your
              portfolio can’t sync. <strong>Reconnect</strong>, <strong>Disconnect</strong>, or
              explore everything with sample data right now:
            </p>
            <DemoButton />
          </div>
        )}

        {!summary || !summary.connected ? (
          autoSyncable ? (
            <AutoSync connectionId={connection!.id}>{connectPrompt}</AutoSync>
          ) : (
            connectPrompt
          )
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

      {/* Next steps — quick jumps into the core flows */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Next steps</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Research a stock", "Get a grounded AI analysis", "/research"],
            ["See opportunities", "Ranked watches + ideas to research", "/opportunities"],
            ["Practice risk-free", "Paper-trade with fake money", "/paper"],
            ["Learn the basics", "Plain-English investing lessons", "/learn"],
          ].map(([title, desc, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border p-4 transition hover:border-blue-300 hover:bg-blue-50/40"
            >
              <div className="text-sm font-medium text-neutral-900">{title}</div>
              <div className="mt-0.5 text-xs text-neutral-500">{desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
