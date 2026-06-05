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
      setGroups(await apiFetch<OpportunityGroup[]>("/api/v1/opportunities", token));
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
      <View style={styles.upgrade}>
        <Text style={styles.upgradeTitle}>Opportunities is an Investor feature.</Text>
        <Text style={styles.upgradeBody}>
          Upgrade to see ranked watches and warnings built from your own analyses.
        </Text>
      </View>
    );
  }

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <View style={{ flex: 1, gap: 12 }}>
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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
          {groups.map((g) => (
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
          ))}
          <Text style={styles.disclaimer}>
            Ranked from your stored analyses, risk and news — educational signals, not advice.
          </Text>
        </ScrollView>
      )}
    </View>
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
});
