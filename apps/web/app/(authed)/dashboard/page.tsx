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
interface OppItem {
  ticker: string;
  name: string;
  type: string;
  score: number;
}
interface OppGroup {
  type: string;
  label: string;
  items: OppItem[];
}

const INDEX_LABELS: Record<string, string> = {
  SPY: "S&P 500",
  QQQ: "Nasdaq 100",
  DIA: "Dow Jones",
  IWM: "Russell 2000",
};

// Sparing accent system (navy/slate base): green = opportunity, amber = watch-out,
// red = risk, blue = neutral/info, slate = quiet.
type Tone = "green" | "amber" | "red" | "blue" | "slate";
const TONE_TEXT: Record<Tone, string> = {
  green: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
  blue: "text-blue-600",
  slate: "text-slate-900",
};
const TONE_DOT: Record<Tone, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
  slate: "bg-slate-400",
};

/** Map an opportunity type → a Watch-framed action verb + tone + sort priority.
 *  NON-ADVISORY: "Watch"/"Review"/"Hold", never "Buy"/"Sell". */
const ACTION_META: Record<string, { verb: string; tone: Tone; priority: number }> = {
  HIGH_RISK_HOLDING: { verb: "High risk — review", tone: "red", priority: 0 },
  REVIEW: { verb: "Review", tone: "amber", priority: 1 },
  AVOID: { verb: "Avoid", tone: "red", priority: 2 },
  BUY_WATCH: { verb: "Watch", tone: "green", priority: 3 },
  ETF: { verb: "Watch (ETF)", tone: "green", priority: 3 },
  REBUY: { verb: "Rebuy watch", tone: "green", priority: 4 },
  WATCHING: { verb: "Hold", tone: "slate", priority: 5 },
};

const money = (v: number | string | null) =>
  v == null ? "—" : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function scoreTone(v: number | null): Tone {
  if (v == null) return "slate";
  if (v >= 80) return "green";
  if (v >= 60) return "blue";
  if (v >= 40) return "amber";
  return "red";
}

async function safe<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path);
  } catch {
    return null;
  }
}

function ScoreCard({
  label,
  value,
  suffix,
  href,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  href?: string;
  tone: Tone;
}) {
  const cls = `block rounded-xl border border-slate-200 bg-white p-4${
    href ? " transition hover:border-blue-300 hover:shadow-sm" : ""
  }`;
  const body = (
    <>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-3xl font-bold ${TONE_TEXT[tone]}`}>{value}</span>
        {suffix && <span className="text-sm text-slate-400">{suffix}</span>}
      </div>
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

interface ActionRow {
  key: string;
  tone: Tone;
  primary: string;
  secondary?: string;
  verb: string;
  href: string;
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

  // Today's briefing — Home is the single home for reviews. Fetch the stored
  // review (generate today's on the fly if none) for the full ReviewsUI below.
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

  // Market overview + opportunities (all best-effort).
  const [overview, oppGroups, clerkUser] = await Promise.all([
    safe<MarketOverview>("/api/v1/market/overview"),
    safe<OppGroup[]>("/api/v1/opportunities"),
    currentUser().catch(() => null),
  ]);
  const firstName = clerkUser?.firstName ?? null;
  const indices = overview?.indices ?? [];

  // Scores
  const avgChg = indices.length
    ? indices.reduce((s, i) => s + (i.changePct ?? 0), 0) / indices.length
    : 0;
  const marketScore = indices.length ? clamp(50 + avgChg * 10) : null;
  const portfolioScore = reviewContent?.healthScore ?? null;
  const oppCount = oppGroups?.reduce((n, g) => n + g.items.length, 0) ?? 0;
  const riskAlerts = reviewContent?.flags.filter((f) => f.severity === "warn").length ?? 0;

  // Today's actions — Watch-framed, drawn from the user's own opportunities,
  // topped up with portfolio-level warnings from the review. Highest-priority
  // (risk/review) first, then conviction (score).
  const actions: ActionRow[] = (oppGroups ?? [])
    .flatMap((g) => g.items)
    .map((it) => ({ it, meta: ACTION_META[it.type] ?? ACTION_META.WATCHING }))
    .sort((a, b) => a.meta.priority - b.meta.priority || b.it.score - a.it.score)
    .slice(0, 6)
    .map(({ it, meta }) => ({
      key: `opp:${it.ticker}`,
      tone: meta.tone,
      primary: it.ticker,
      secondary: it.name,
      verb: meta.verb,
      href: `/research?ticker=${it.ticker}`,
    }));
  if (actions.length < 4) {
    for (const f of reviewContent?.flags.filter((fl) => fl.severity === "warn") ?? []) {
      if (actions.length >= 4) break;
      const tkr = f.tickers?.[0];
      actions.push({
        key: `flag:${f.title}`,
        tone: "amber",
        primary: f.title,
        secondary: f.detail,
        verb: tkr ? "Review" : "Heads up",
        href: tkr ? `/research?ticker=${tkr}` : "/portfolio",
      });
    }
  }

  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const isDemo = connection?.status === "demo";
  const isDisabled = connection?.status === "disabled";
  // A real, non-disabled connection with no holdings yet should pull on load
  // (e.g. right after connecting) instead of making the user hit Sync.
  const autoSyncable = Boolean(connection) && !isDemo && !isDisabled;

  const connectPrompt = (
    <div className="rounded-md border border-dashed p-6 text-center text-sm text-slate-600">
      <p className="mb-3">Connect a brokerage to see your holdings and a health score.</p>
      <div className="flex flex-col items-center gap-2">
        <ConnectButton />
        <span className="text-xs text-slate-400">or explore first</span>
        <DemoButton />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm text-slate-500">
          {dateStr}
          {me ? ` · ${me.plan.replace("_", " ")} plan` : ""}
        </p>
      </div>

      <OnboardingGuide isNewUser={isNewUser} />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load your account: {error}
        </div>
      )}

      {/* Score cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ScoreCard
          label="Portfolio score"
          value={portfolioScore != null ? String(portfolioScore) : "—"}
          suffix={portfolioScore != null ? "/100" : undefined}
          tone={scoreTone(portfolioScore)}
          href="/portfolio"
        />
        <ScoreCard
          label="Market score"
          value={marketScore != null ? String(marketScore) : "—"}
          suffix={marketScore != null ? "/100" : undefined}
          tone={scoreTone(marketScore)}
        />
        <ScoreCard
          label="Opportunities"
          value={String(oppCount)}
          tone={oppCount > 0 ? "blue" : "slate"}
          href="/opportunities"
        />
        <ScoreCard
          label="Risk alerts"
          value={String(riskAlerts)}
          tone={riskAlerts > 0 ? "red" : "slate"}
        />
      </div>

      {/* Today's actions — the page's focal point */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Today’s actions</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-2">
          {actions.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {actions.map((a) => (
                <li key={a.key}>
                  <Link
                    href={a.href}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[a.tone]}`} />
                      <span className="min-w-0 truncate">
                        <span className="font-semibold text-slate-900">{a.primary}</span>
                        {a.secondary && (
                          <span className="ml-2 text-xs text-slate-500">{a.secondary}</span>
                        )}
                      </span>
                    </span>
                    <span className={`shrink-0 text-xs font-semibold ${TONE_TEXT[a.tone]}`}>
                      {a.verb}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-6 text-center text-sm text-slate-500">
              No actions yet.{" "}
              <Link href="/research" className="text-blue-600 hover:underline">
                Analyze a stock
              </Link>{" "}
              or{" "}
              <Link href="/opportunities" className="text-blue-600 hover:underline">
                browse opportunities
              </Link>{" "}
              and your daily actions show up here.
            </div>
          )}
        </div>
        <p className="text-[11px] text-slate-400">
          Educational “Watch” signals from your own analyses — not buy/sell advice.
        </p>
      </section>

      {/* Compact market snapshot */}
      {indices.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Markets</span>
          {indices.map((i) => (
            <span key={i.ticker} className="flex items-baseline gap-1.5">
              <span className="text-slate-500">{INDEX_LABELS[i.ticker] ?? i.ticker}</span>
              <span
                className={`font-semibold ${
                  (i.changePct ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {i.changePct == null
                  ? "—"
                  : `${i.changePct >= 0 ? "+" : ""}${i.changePct.toFixed(2)}%`}
              </span>
            </span>
          ))}
        </div>
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
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="text-lg font-semibold">{val}</div>
                </div>
              ))}
            </div>

            {accounts?.map((a) => (
              <div key={a.id} className="rounded-md border p-4">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium">{a.name ?? "Account"}</span>
                  <span className="text-slate-500">{money(a.totalValue)}</span>
                </div>
                {a.holdings.length === 0 ? (
                  <p className="text-xs text-slate-500">No holdings synced yet.</p>
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
                          <span className="text-slate-500">× {Number(h.quantity)}</span>
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

      {/* Today's briefing — full review lives on Home (Reviews page removed). */}
      {summary?.connected && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Today’s briefing</h2>
          <ReviewsUI initial={reviewInitial} gated={reviewGated} />
        </section>
      )}

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
              <div className="text-sm font-medium text-slate-900">{title}</div>
              <div className="mt-0.5 text-xs text-slate-500">{desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
