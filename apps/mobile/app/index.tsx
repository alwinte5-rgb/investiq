import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SignedIn, SignedOut, useAuth, useUser } from "@clerk/clerk-expo";
import { Link } from "expo-router";
import { apiFetch } from "../lib/api";
import { colors, scoreTone, toneDot, toneText, type Tone } from "../lib/theme";

interface Me {
  plan: "FREE" | "INVESTOR" | "INVESTOR_PLUS";
  role: "USER" | "ADMIN";
}
interface Summary {
  positions: number;
  totalValue: number;
  cash: number;
  connected: boolean;
}
interface Connection {
  id: string;
  status: string;
}
interface Holding {
  id: string;
  quantity: string | number;
  marketValue: string | number | null;
  symbol: { ticker: string; name: string };
}
interface Account {
  id: string;
  name: string | null;
  totalValue: string | number;
  holdings: Holding[];
}
interface MarketIndex {
  ticker: string;
  price: number;
  changePct: number | null;
}
interface ReviewFlag {
  severity: "info" | "warn";
  title: string;
  detail: string;
  tickers?: string[];
}
interface ReviewContent {
  healthScore: number;
  flags: ReviewFlag[];
}
interface StoredReview {
  content: ReviewContent;
}
interface OppItem {
  ticker: string;
  name: string;
  type: string;
  score: number;
}
interface OppGroup {
  type: string;
  items: OppItem[];
}

const INDEX_LABELS: Record<string, string> = {
  SPY: "S&P 500",
  QQQ: "Nasdaq",
  DIA: "Dow",
  IWM: "Russell",
};

// Watch-framed action verbs (NON-ADVISORY — never Buy/Sell). Mirrors web ACTION_META.
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

interface ActionRow {
  key: string;
  tone: Tone;
  primary: string;
  secondary?: string;
  verb: string;
  href: string;
}

function ScoreCard({
  label,
  value,
  suffix,
  tone,
  href,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone: Tone;
  href?: string;
}) {
  const body = (
    <View style={styles.scoreCard}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.scoreValueRow}>
        <Text style={[styles.scoreValue, { color: toneText[tone] }]}>{value}</Text>
        {suffix && <Text style={styles.scoreSuffix}>{suffix}</Text>}
      </View>
    </View>
  );
  return href ? (
    <Link href={href} asChild>
      <Pressable style={styles.scoreCardWrap}>{body}</Pressable>
    </Link>
  ) : (
    <View style={styles.scoreCardWrap}>{body}</View>
  );
}

/** New-user / sample-data onboarding card (kept from prior build). */
function SampleData({
  summary,
  connection,
  onChanged,
}: {
  summary: Summary | null;
  connection: Connection | null;
  onChanged: () => void;
}) {
  const { getToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDemo = connection?.status === "demo";
  if (summary?.connected && !isDemo) return null;

  async function loadDemo() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      await apiFetch("/api/v1/connections/demo", token, { method: "POST" });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sample data");
    } finally {
      setBusy(false);
    }
  }
  async function removeDemo() {
    if (busy || !connection) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      await apiFetch(`/api/v1/connections/${connection.id}`, token, { method: "DELETE" });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.onboard}>
      {isDemo ? (
        <>
          <Text style={styles.onboardBody}>
            Sample data loaded — {summary?.positions ?? 0} positions. Explore Portfolio or the
            briefing below.
          </Text>
          <Pressable onPress={removeDemo} disabled={busy} style={styles.onboardBtn}>
            <Text style={styles.onboardBtnText}>{busy ? "Removing…" : "Remove sample data"}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.onboardTitle}>👋 New to InvestIQ?</Text>
          <Text style={styles.onboardBody}>
            Research stocks and ETFs and learn as you go — in plain English. We never tell you to buy
            or sell; we help you decide for yourself.
          </Text>
          <Pressable onPress={loadDemo} disabled={busy} style={styles.onboardBtn}>
            <Text style={styles.onboardBtnText}>
              {busy ? "Loading…" : "Explore with sample data"}
            </Text>
          </Pressable>
          <Link href="/research" style={styles.onboardLink}>
            Or research a stock →
          </Link>
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function Home() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [me, setMe] = useState<Me | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [oppGroups, setOppGroups] = useState<OppGroup[]>([]);
  const [review, setReview] = useState<ReviewContent | null>(null);
  const [loading, setLoading] = useState(true);

  const safe = useCallback(async <T,>(path: string, token: string | null): Promise<T | null> => {
    try {
      return await apiFetch<T>(path, token);
    } catch {
      return null;
    }
  }, []);

  const load = useCallback(async () => {
    const token = await getToken().catch(() => null);
    const [m, s, conns, accts, overview, opps] = await Promise.all([
      safe<Me>("/api/v1/me", token),
      safe<Summary>("/api/v1/portfolio/summary", token),
      safe<Connection[]>("/api/v1/connections", token),
      safe<Account[]>("/api/v1/accounts", token),
      safe<{ indices: MarketIndex[] }>("/api/v1/market/overview", token),
      safe<OppGroup[]>("/api/v1/opportunities", token),
    ]);
    setMe(m);
    setSummary(s);
    setConnection(conns?.[0] ?? null);
    setAccounts(accts ?? []);
    setIndices(overview?.indices ?? []);
    setOppGroups(opps ?? []);
    // Briefing only when connected — mirrors web (no review without holdings).
    if (s?.connected) {
      let row = await safe<StoredReview | null>("/api/v1/portfolio/reviews", token);
      if (!row) {
        // POST to generate today's briefing if none stored.
        try {
          const gen = await apiFetch<{ status: string; review?: StoredReview }>(
            "/api/v1/portfolio/reviews?period=MORNING",
            token,
            { method: "POST" },
          );
          if (gen.review) row = gen.review;
        } catch {
          /* best-effort */
        }
      }
      setReview(row?.content ?? null);
    } else {
      setReview(null);
    }
    setLoading(false);
  }, [getToken, safe]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;

  // Scores
  const avgChg = indices.length
    ? indices.reduce((sum, i) => sum + (i.changePct ?? 0), 0) / indices.length
    : 0;
  const marketScore = indices.length ? clamp(50 + avgChg * 10) : null;
  const portfolioScore = review?.healthScore ?? null;
  const oppCount = oppGroups.reduce((n, g) => n + g.items.length, 0);
  const riskAlerts = review?.flags.filter((f) => f.severity === "warn").length ?? 0;

  // Today's actions
  const actions: ActionRow[] = oppGroups
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
    for (const f of review?.flags.filter((fl) => fl.severity === "warn") ?? []) {
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 18, paddingBottom: 32 }}>
      {/* Hero */}
      <View>
        <Text style={styles.greeting}>
          {greeting}
          {user?.firstName ? `, ${user.firstName}` : ""}
        </Text>
        <Text style={styles.subtle}>
          {dateStr}
          {me ? ` · ${me.plan.replace("_", " ")} plan` : ""}
        </Text>
      </View>

      <SampleData summary={summary} connection={connection} onChanged={load} />

      {/* Score cards */}
      <View style={styles.scoreGrid}>
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
      </View>

      {/* Today's actions */}
      <View style={{ gap: 8 }}>
        <Text style={styles.h2}>Today’s actions</Text>
        <View style={styles.card}>
          {actions.length > 0 ? (
            actions.map((a, i) => (
              <Link key={a.key} href={a.href} asChild>
                <Pressable style={[styles.actionRow, i > 0 && styles.actionDivider]}>
                  <View style={styles.actionLeft}>
                    <View style={[styles.dot, { backgroundColor: toneDot[a.tone] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actionPrimary} numberOfLines={1}>
                        {a.primary}
                      </Text>
                      {a.secondary && (
                        <Text style={styles.actionSecondary} numberOfLines={1}>
                          {a.secondary}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.actionVerb, { color: toneText[a.tone] }]}>{a.verb}</Text>
                </Pressable>
              </Link>
            ))
          ) : (
            <Text style={styles.emptyText}>
              No actions yet. Analyze a stock or browse opportunities and your daily actions show up
              here.
            </Text>
          )}
        </View>
        <Text style={styles.caption}>
          Educational “Watch” signals from your own analyses — not buy/sell advice.
        </Text>
      </View>

      {/* Market snapshot */}
      {indices.length > 0 && (
        <View style={styles.marketBar}>
          <Text style={styles.marketLabel}>MARKETS</Text>
          <View style={styles.marketItems}>
            {indices.map((i) => (
              <View key={i.ticker} style={styles.marketItem}>
                <Text style={styles.marketName}>{INDEX_LABELS[i.ticker] ?? i.ticker}</Text>
                <Text
                  style={[
                    styles.marketPct,
                    { color: (i.changePct ?? 0) >= 0 ? colors.green : colors.red },
                  ]}
                >
                  {i.changePct == null
                    ? "—"
                    : `${i.changePct >= 0 ? "+" : ""}${i.changePct.toFixed(2)}%`}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Portfolio */}
      {summary?.connected && (
        <View style={{ gap: 8 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.h2}>Portfolio</Text>
            {connection?.status === "demo" && <Text style={styles.sampleBadge}>Sample data</Text>}
          </View>
          <View style={styles.statRow}>
            <Stat label="Total value" value={money(summary.totalValue)} />
            <Stat label="Cash" value={money(summary.cash)} />
            <Stat label="Positions" value={String(summary.positions)} />
          </View>
          {accounts.map((a) => (
            <View key={a.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.acctName}>{a.name ?? "Account"}</Text>
                <Text style={styles.subtle}>{money(a.totalValue)}</Text>
              </View>
              {a.holdings.length === 0 ? (
                <Text style={styles.caption}>No holdings synced yet.</Text>
              ) : (
                a.holdings.map((h) => (
                  <Link key={h.id} href={`/research?ticker=${h.symbol.ticker}`} asChild>
                    <Pressable style={styles.holdingRow}>
                      <Text style={styles.holdingTicker}>
                        {h.symbol.ticker} <Text style={styles.subtle}>× {Number(h.quantity)}</Text>
                      </Text>
                      <Text style={styles.holdingValue}>{money(h.marketValue)}</Text>
                    </Pressable>
                  </Link>
                ))
              )}
            </View>
          ))}
        </View>
      )}

      {/* Today's briefing */}
      {summary?.connected && review && (
        <View style={{ gap: 8 }}>
          <Text style={styles.h2}>Today’s briefing</Text>
          <View style={styles.card}>
            {review.flags.length === 0 ? (
              <Text style={styles.caption}>No flags today — your portfolio looks steady.</Text>
            ) : (
              review.flags.slice(0, 5).map((f, i) => (
                <View
                  key={i}
                  style={[styles.flag, f.severity === "warn" ? styles.flagWarn : styles.flagInfo]}
                >
                  <Text style={styles.flagTitle}>{f.title}</Text>
                  <Text style={styles.flagDetail}>{f.detail}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* Next steps */}
      <View style={{ gap: 8 }}>
        <Text style={styles.h2}>Next steps</Text>
        {(
          [
            ["Research a stock", "Get a grounded AI analysis", "/research"],
            ["See opportunities", "Ranked watches + ideas", "/opportunities"],
            ["Ask the AI Advisor", "Non-advisory, grounded answers", "/advisor"],
            ["Practice risk-free", "Paper-trade with fake money", "/paper"],
            ["Learn the basics", "Plain-English lessons", "/learn"],
          ] as const
        ).map(([title, desc, href]) => (
          <Link key={href} href={href} asChild>
            <Pressable style={styles.nextCard}>
              <Text style={styles.nextTitle}>{title}</Text>
              <Text style={styles.caption}>{desc}</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      <Text style={styles.disclaimer}>
        Educational research only — not investment advice. Investing involves risk of loss.
      </Text>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <Pressable onPress={() => signOut()}>
      <Text style={styles.signOut}>Sign out</Text>
    </Pressable>
  );
}

export default function Index() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerRow}>
        <Text style={styles.brand}>
          Invest<Text style={styles.brandAccent}>IQ</Text>
        </Text>
        <SignedIn>
          <Link href="/settings" style={styles.settingsLink}>
            Settings
          </Link>
        </SignedIn>
      </View>
      <SignedIn>
        <Home />
        <SignOutButton />
      </SignedIn>
      <SignedOut>
        <View style={styles.card}>
          <Text style={styles.subtle}>Sign in to view your research dashboard.</Text>
          <Link href="/sign-in" style={styles.signInLink}>
            Sign in
          </Link>
          <Link href="/sign-up" style={styles.muted}>
            Create an account
          </Link>
        </View>
      </SignedOut>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 14 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontSize: 24, fontWeight: "700", color: colors.ink },
  brandAccent: { color: colors.blue },
  settingsLink: { color: colors.blue, fontWeight: "600", fontSize: 14 },
  greeting: { fontSize: 24, fontWeight: "700", color: colors.ink },
  subtle: { fontSize: 13, color: colors.slate500 },
  muted: { fontSize: 13, color: colors.slate500, textAlign: "center" },
  h2: { fontSize: 17, fontWeight: "700", color: colors.ink },
  card: { borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 14, padding: 12, gap: 8 },
  caption: { fontSize: 12, color: colors.slate400 },

  // Score cards
  scoreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  scoreCardWrap: { flexBasis: "47%", flexGrow: 1 },
  scoreCard: { borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 14, padding: 14 },
  scoreLabel: { fontSize: 12, fontWeight: "600", color: colors.slate500 },
  scoreValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 4 },
  scoreValue: { fontSize: 28, fontWeight: "800" },
  scoreSuffix: { fontSize: 13, color: colors.slate400 },

  // Actions
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, gap: 8 },
  actionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.slate100 },
  actionLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  actionPrimary: { fontSize: 14, fontWeight: "700", color: colors.ink },
  actionSecondary: { fontSize: 12, color: colors.slate500 },
  actionVerb: { fontSize: 12, fontWeight: "700" },
  emptyText: { fontSize: 13, color: colors.slate500, paddingVertical: 12, textAlign: "center", lineHeight: 19 },

  // Market bar
  marketBar: { borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 14, padding: 12, gap: 6 },
  marketLabel: { fontSize: 11, fontWeight: "700", color: colors.slate400, letterSpacing: 0.5 },
  marketItems: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  marketItem: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  marketName: { fontSize: 13, color: colors.slate500 },
  marketPct: { fontSize: 13, fontWeight: "700" },

  // Portfolio
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sampleBadge: { fontSize: 11, fontWeight: "600", color: colors.amber700, backgroundColor: colors.amber50, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" },
  statRow: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 12, padding: 10 },
  statLabel: { fontSize: 11, color: colors.slate500 },
  statValue: { fontSize: 15, fontWeight: "700", color: colors.ink, marginTop: 2 },
  acctName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  holdingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.slate100, paddingTop: 8 },
  holdingTicker: { fontSize: 14, fontWeight: "600", color: colors.blue },
  holdingValue: { fontSize: 14, color: colors.ink },

  // Briefing flags
  flag: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 2 },
  flagWarn: { backgroundColor: colors.amber50, borderColor: "#fde68a" },
  flagInfo: { backgroundColor: colors.blue50, borderColor: colors.blue200 },
  flagTitle: { fontWeight: "600", fontSize: 13, color: colors.ink },
  flagDetail: { fontSize: 12, color: colors.slate600 },

  // Next steps
  nextCard: { borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 12, padding: 14, gap: 2 },
  nextTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },

  // Onboarding
  onboard: { borderWidth: 1, borderColor: colors.blue200, backgroundColor: colors.blue50, borderRadius: 14, padding: 16, gap: 8 },
  onboardTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  onboardBody: { fontSize: 13, color: colors.slate700, lineHeight: 19 },
  onboardBtn: { borderWidth: 1, borderColor: colors.blue, borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 2 },
  onboardBtnText: { color: colors.blue, fontWeight: "700" },
  onboardLink: { color: colors.blue, fontWeight: "600", fontSize: 13 },

  signInLink: { color: colors.blue, fontWeight: "700", textAlign: "center", fontSize: 15 },
  signOut: { color: colors.slate500, fontWeight: "600", textAlign: "center", paddingVertical: 4 },
  disclaimer: { fontSize: 11, color: colors.slate400, textAlign: "center" },
  error: { color: colors.red700, fontSize: 13 },
});
