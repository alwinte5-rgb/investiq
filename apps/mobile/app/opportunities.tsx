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
import { SignedIn, SignedOut, useAuth } from "@clerk/clerk-expo";
import { Link } from "expo-router";
import { apiFetch } from "../lib/api";
import { colors, toneBadge, toneText, type Tone } from "../lib/theme";

type OpportunityType =
  | "BUY_WATCH"
  | "ETF"
  | "REBUY"
  | "HIGH_RISK_HOLDING"
  | "REVIEW"
  | "AVOID"
  | "WATCHING";
interface Opportunity {
  ticker: string;
  name: string;
  type: OpportunityType;
  score: number;
  confidence: number;
  risk: number;
  explanation: string;
  supporting: {
    warningColor: "GREEN" | "YELLOW" | "ORANGE" | "RED" | null;
    newsTone: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | null;
    held: boolean;
  };
}
interface OpportunityGroup {
  type: OpportunityType;
  label: string;
  items: Opportunity[];
}

// Watch-framed verdicts (NON-ADVISORY — never Buy/Sell). Mirrors web VERDICT/PRIORITY.
const VERDICT: Record<OpportunityType, { label: string; tone: Tone }> = {
  BUY_WATCH: { label: "Buy Watch", tone: "green" },
  ETF: { label: "ETF Watch", tone: "green" },
  REBUY: { label: "Rebuy Watch", tone: "green" },
  REVIEW: { label: "Review", tone: "amber" },
  HIGH_RISK_HOLDING: { label: "High-Risk Holding", tone: "red" },
  AVOID: { label: "Avoid", tone: "red" },
  WATCHING: { label: "Watching", tone: "slate" },
};
const PRIORITY: Record<OpportunityType, number> = {
  HIGH_RISK_HOLDING: 0,
  REVIEW: 1,
  AVOID: 2,
  BUY_WATCH: 3,
  ETF: 3,
  REBUY: 4,
  WATCHING: 5,
};

function riskLabel(r: number): string {
  return r < 34 ? "Low" : r < 67 ? "Medium" : "High";
}

interface ScreenedStock {
  ticker: string;
  name: string;
  marketCap: number | null;
  price: number | null;
}
interface DiscoveryGroup {
  key: string;
  title: string;
  items: ScreenedStock[];
}

function mcap(n: number | null): string {
  if (n == null) return "";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(0)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
}

function OpportunityCard({ o }: { o: Opportunity }) {
  const v = VERDICT[o.type];
  const badge = toneBadge[v.tone];
  const news = o.supporting.newsTone;
  return (
    <Link href={`/research?ticker=${o.ticker}`} asChild>
      <Pressable style={styles.oppCard}>
        <View style={styles.oppTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.oppTickerRow}>
              <Text style={styles.oppTicker}>{o.ticker}</Text>
              {o.supporting.held && <Text style={styles.heldBadge}>Held</Text>}
            </View>
            <Text style={styles.oppName} numberOfLines={1}>
              {o.name}
            </Text>
          </View>
          <Text style={[styles.verdictBadge, { backgroundColor: badge.bg, color: badge.fg }]}>
            {v.label}
          </Text>
        </View>

        <View style={styles.oppScoreRow}>
          <View>
            <Text style={styles.oppScoreLabel}>OPPORTUNITY</Text>
            <Text style={[styles.oppScore, { color: toneText[v.tone] }]}>{o.score}</Text>
          </View>
          <View style={styles.oppMetrics}>
            <View style={styles.oppMetric}>
              <Text style={styles.oppMetricLabel}>Confidence</Text>
              <Text style={styles.oppMetricValue}>{o.confidence}%</Text>
            </View>
            <View style={styles.oppMetric}>
              <Text style={styles.oppMetricLabel}>Risk</Text>
              <Text style={styles.oppMetricValue}>{riskLabel(o.risk)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.oppExplain}>{o.explanation}</Text>

        {news && (
          <Text
            style={[
              styles.newsTag,
              news === "POSITIVE"
                ? { backgroundColor: colors.green50, color: colors.green700 }
                : news === "NEGATIVE"
                  ? { backgroundColor: colors.red50, color: colors.red700 }
                  : { backgroundColor: colors.slate100, color: colors.slate600 },
            ]}
          >
            News: {news.toLowerCase()}
          </Text>
        )}

        <Text style={styles.openLink}>Open analysis →</Text>
      </Pressable>
    </Link>
  );
}

function Feed({ groups }: { groups: OpportunityGroup[] }) {
  const items = groups
    .flatMap((g) => g.items)
    .sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type] || b.score - a.score);
  return (
    <View style={{ gap: 10 }}>
      {items.map((o) => (
        <OpportunityCard key={`${o.type}:${o.ticker}`} o={o} />
      ))}
    </View>
  );
}

function DiscoverIdeas({ groups }: { groups: DiscoveryGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.h2}>Ideas to research</Text>
      <Text style={styles.subtle}>
        Stocks matching factual screens — starting points, not recommendations. Tap to analyze.
      </Text>
      {groups.map((g) => (
        <View key={g.key} style={{ gap: 4 }}>
          <Text style={styles.discoverTitle}>{g.title}</Text>
          {g.items.map((s) => (
            <Link key={s.ticker} href={`/research?ticker=${s.ticker}`} asChild>
              <Pressable style={styles.discoverRow}>
                <Text style={styles.discoverTicker}>{s.ticker}</Text>
                <Text style={styles.subtle}>
                  {s.price != null ? `$${s.price.toFixed(2)}` : "—"} {mcap(s.marketCap)}
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
      ))}
    </View>
  );
}

function Opportunities() {
  const { getToken } = useAuth();
  const [market, setMarket] = useState<OpportunityGroup[]>([]);
  const [groups, setGroups] = useState<OpportunityGroup[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [gated, setGated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken().catch(() => null);
    // Market watches (global) — best-effort, never blocks the page.
    setMarket(
      await apiFetch<OpportunityGroup[]>("/api/v1/opportunities/market", token).catch(() => []),
    );
    setDiscovery(await apiFetch<DiscoveryGroup[]>("/api/v1/discovery", token).catch(() => []));
    try {
      let g = await apiFetch<OpportunityGroup[]>("/api/v1/opportunities", token);
      if (g.length === 0) {
        try {
          g = await apiFetch<OpportunityGroup[]>("/api/v1/opportunities", token, { method: "POST" });
        } catch {
          /* leave empty — UI shows guidance */
        }
      }
      setGroups(g);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/\b403\b|investor plan|forbidden/i.test(msg)) setGated(true);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      setGroups(
        await apiFetch<OpportunityGroup[]>("/api/v1/opportunities", token, { method: "POST" }),
      );
      setGated(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to refresh";
      if (/\b403\b|investor plan|forbidden/i.test(msg)) setGated(true);
      else setError(msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  const marketTotal = market.reduce((n, g) => n + g.items.length, 0);
  const personalTotal = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 18, paddingBottom: 28 }}>
      {/* Market watches */}
      <View style={{ gap: 8 }}>
        <Text style={styles.h2}>Market watches</Text>
        <Text style={styles.subtle}>
          AI-surfaced across the market — the same educational “Watch” candidates for everyone. Not
          buy/sell or personalized advice.
        </Text>
        {marketTotal === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              The market scan hasn’t produced watches yet — it refreshes on a schedule. Check back
              soon, or analyze any ticker to build your own list.
            </Text>
          </View>
        ) : (
          <Feed groups={market} />
        )}
      </View>

      {/* From your analyses */}
      <View style={styles.divider} />
      <View style={{ gap: 8 }}>
        <View style={styles.rowBetween}>
          <Text style={styles.h2}>From your analyses</Text>
          {!gated && (
            <Pressable onPress={refresh} disabled={busy}>
              <Text style={[styles.refresh, busy && styles.disabled]}>
                {busy ? "Refreshing…" : "Refresh"}
              </Text>
            </Pressable>
          )}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {gated ? (
          <View style={styles.upgrade}>
            <Text style={styles.upgradeTitle}>Opportunities is an Investor feature.</Text>
            <Text style={styles.upgradeBody}>
              Upgrade to see ranked watches and warnings built from your own analyses.
            </Text>
          </View>
        ) : personalTotal === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Nothing analyzed yet. Every stock you analyze shows up here. Pick any of the ideas
              below to get started.
            </Text>
          </View>
        ) : (
          <Feed groups={groups} />
        )}

        {personalTotal > 0 && (
          <Text style={styles.caption}>
            Ranked from your stored analyses, risk and news — educational signals, not advice.
          </Text>
        )}
      </View>

      {/* Ideas to research */}
      <DiscoverIdeas groups={discovery} />
    </ScrollView>
  );
}

export default function OpportunitiesScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Link href="/" style={styles.back}>
        ← Home
      </Link>
      <Text style={styles.h1}>Opportunities</Text>
      <SignedIn>
        <Opportunities />
      </SignedIn>
      <SignedOut>
        <Text style={styles.hint}>Sign in to see your opportunities.</Text>
      </SignedOut>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 12 },
  back: { color: colors.blue, fontWeight: "600" },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink },
  h2: { fontSize: 17, fontWeight: "700", color: colors.ink },
  subtle: { fontSize: 13, color: colors.slate500, lineHeight: 18 },
  caption: { fontSize: 11, color: colors.slate400 },
  hint: { fontSize: 13, color: colors.slate500 },
  error: { color: colors.red700, fontSize: 13 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.slate200 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  refresh: { color: colors.blue, fontWeight: "600", fontSize: 13 },
  disabled: { opacity: 0.5 },

  // Card
  oppCard: { borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 14, padding: 14, gap: 10 },
  oppTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  oppTickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  oppTicker: { fontSize: 16, fontWeight: "800", color: colors.ink },
  heldBadge: { fontSize: 10, color: colors.slate600, backgroundColor: colors.slate100, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, overflow: "hidden" },
  oppName: { fontSize: 12, color: colors.slate500 },
  verdictBadge: { fontSize: 11, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
  oppScoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  oppScoreLabel: { fontSize: 10, fontWeight: "600", color: colors.slate400, letterSpacing: 0.5 },
  oppScore: { fontSize: 30, fontWeight: "800" },
  oppMetrics: { flexDirection: "row", gap: 16 },
  oppMetric: { alignItems: "flex-end" },
  oppMetricLabel: { fontSize: 11, color: colors.slate400 },
  oppMetricValue: { fontSize: 13, fontWeight: "700", color: colors.slate700 },
  oppExplain: { fontSize: 12, color: colors.slate600, lineHeight: 18 },
  newsTag: { alignSelf: "flex-start", fontSize: 10, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: "hidden" },
  openLink: { fontSize: 12, fontWeight: "600", color: colors.blue },

  // Empty / upgrade
  empty: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.slate300, borderRadius: 14, padding: 16 },
  emptyText: { fontSize: 13, color: colors.slate500, textAlign: "center", lineHeight: 19 },
  upgrade: { backgroundColor: colors.blue50, borderColor: colors.blue200, borderWidth: 1, borderRadius: 14, padding: 16, gap: 6 },
  upgradeTitle: { fontWeight: "700", color: colors.blue700 },
  upgradeBody: { color: colors.blue700, fontSize: 13, lineHeight: 18 },

  // Discover
  discoverTitle: { fontSize: 13, fontWeight: "600", color: colors.slate700, marginTop: 2 },
  discoverRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.slate200, paddingVertical: 8 },
  discoverTicker: { fontWeight: "700", color: colors.blue, fontSize: 14 },
});
