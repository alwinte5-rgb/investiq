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

type OpportunityType = "BUY_WATCH" | "ETF" | "REBUY" | "HIGH_RISK_HOLDING" | "REVIEW" | "AVOID";
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
    held: boolean;
  };
}
interface OpportunityGroup {
  type: OpportunityType;
  label: string;
  items: Opportunity[];
}

const COLOR_DOT: Record<string, string> = {
  GREEN: "#15803d",
  YELLOW: "#b45309",
  ORANGE: "#c2410c",
  RED: "#b91c1c",
};

interface ScreenedStock {
  ticker: string;
  name: string;
  sector: string | null;
  marketCap: number | null;
  price: number | null;
  beta: number | null;
  assetType: "STOCK" | "ETF";
}
interface DiscoveryGroup {
  key: string;
  title: string;
  blurb: string;
  items: ScreenedStock[];
}

function mcap(n: number | null): string {
  if (n == null) return "";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(0)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
}

/** Screened "ideas to research" — factual screens, not AI signals. Tap to analyze. */
function DiscoverIdeas() {
  const { getToken } = useAuth();
  const [groups, setGroups] = useState<DiscoveryGroup[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getToken();
        const g = await apiFetch<DiscoveryGroup[]>("/api/v1/discovery", token);
        if (active) setGroups(g);
      } catch {
        /* discovery is an optional aid */
      }
    })();
    return () => {
      active = false;
    };
  }, [getToken]);

  if (groups.length === 0) return null;
  return (
    <View style={{ gap: 10, marginTop: 8 }}>
      <Text style={styles.fieldTitle}>Ideas to research</Text>
      <Text style={styles.meta}>
        Stocks matching factual screens — starting points, not recommendations. Tap to analyze.
      </Text>
      {groups.map((g) => (
        <View key={g.key} style={{ gap: 4 }}>
          <Text style={styles.discoverTitle}>{g.title}</Text>
          {g.items.map((s) => (
            <Link key={s.ticker} href={`/research?ticker=${s.ticker}`} asChild>
              <Pressable style={styles.discoverRow}>
                <Text style={styles.ticker}>{s.ticker}</Text>
                <Text style={styles.meta}>
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
  const [groups, setGroups] = useState<OpportunityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [gated, setGated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      let g = await apiFetch<OpportunityGroup[]>("/api/v1/opportunities", token);
      // Auto-build from stored analyses if nothing is cached — no manual Generate.
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
      setGroups(await apiFetch<OpportunityGroup[]>("/api/v1/opportunities", token, { method: "POST" }));
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
  if (gated) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
        <View style={styles.upgrade}>
          <Text style={styles.upgradeTitle}>Opportunities is an Investor feature.</Text>
          <Text style={styles.upgradeBody}>
            Upgrade to see ranked watches and warnings built from your own analyses.
          </Text>
        </View>
        <DiscoverIdeas />
      </ScrollView>
    );
  }

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
      <Pressable onPress={refresh} disabled={busy} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>{busy ? "Refreshing…" : total > 0 ? "Refresh" : "Generate"}</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      {total === 0 ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Run some stock analyses first — opportunities are built from your stored research, risk
            and news. Then tap Generate.
          </Text>
        </View>
      ) : (
        groups.map((g) => (
          <View key={g.type} style={{ gap: 4 }}>
            <View style={styles.groupHeader}>
              <Text style={styles.fieldTitle}>{g.label}</Text>
              <Text style={styles.count}>{g.items.length}</Text>
            </View>
            {g.items.map((o) => (
              <View key={o.ticker} style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={styles.rowTop}>
                    <Text style={styles.ticker}>{o.ticker}</Text>
                    {o.supporting.held && <Text style={styles.heldBadge}>Held</Text>}
                  </View>
                  <Text style={styles.explain}>{o.explanation}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.score}>{o.score}</Text>
                  <View style={styles.metaRow}>
                    {o.supporting.warningColor && (
                      <View
                        style={[styles.dot, { backgroundColor: COLOR_DOT[o.supporting.warningColor] }]}
                      />
                    )}
                    <Text style={styles.meta}>
                      C{o.confidence}/R{o.risk}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ))
      )}

      {total > 0 && (
        <Text style={styles.disclaimer}>
          Ranked from your stored analyses, risk and news — educational signals, not advice.
        </Text>
      )}

      <DiscoverIdeas />
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
  back: { color: "#2563eb", fontWeight: "600" },
  h1: { fontSize: 22, fontWeight: "600" },
  btn: { backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "white", fontWeight: "600" },
  fieldTitle: { fontWeight: "600", fontSize: 14 },
  groupHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  count: { fontSize: 12, color: "#9ca3af" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 10, borderWidth: 1, borderColor: "#eee", borderRadius: 8, padding: 10 },
  rowLeft: { flex: 1, gap: 2 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  ticker: { fontWeight: "700", fontSize: 14, color: "#1d4ed8" },
  heldBadge: { fontSize: 10, color: "#6b7280", backgroundColor: "#f3f4f6", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, overflow: "hidden" },
  explain: { fontSize: 12, color: "#4b5563" },
  rowRight: { alignItems: "flex-end", gap: 2 },
  score: { fontSize: 15, fontWeight: "700", color: "#111" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  meta: { fontSize: 11, color: "#9ca3af" },
  notice: { backgroundColor: "#fffbeb", borderColor: "#fde68a", borderWidth: 1, borderRadius: 8, padding: 12 },
  noticeText: { color: "#92400e", fontSize: 13 },
  upgrade: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe", borderWidth: 1, borderRadius: 10, padding: 16, gap: 6 },
  upgradeTitle: { fontWeight: "700", color: "#1e40af" },
  upgradeBody: { color: "#1e40af", fontSize: 13 },
  hint: { fontSize: 13, color: "#888" },
  error: { color: "#b91c1c", fontSize: 13 },
  disclaimer: { fontSize: 11, color: "#999", marginTop: 4 },
  discoverTitle: { fontSize: 13, fontWeight: "600", color: "#374151", marginTop: 2 },
  discoverRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
    paddingVertical: 8,
  },
});
