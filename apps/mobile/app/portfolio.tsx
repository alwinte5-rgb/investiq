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

interface SectorWeight {
  sector: string;
  pct: number;
}
interface PortfolioView {
  healthScore: number;
  riskScore: number;
  diversificationScore: number;
  cashScore: number;
  sectorConcentration: SectorWeight[];
  overweight: SectorWeight[];
  underweight: SectorWeight[];
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  generatedAt: string;
}
type GenResult =
  | { status: "scored"; analysis: PortfolioView }
  | { status: "insufficient"; message: string };

function ScoreTile({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

function Bullets({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={[styles.fieldTitle, { color }]}>{title}</Text>
      {items.map((it, i) => (
        <Text key={i} style={styles.bullet}>
          • {it}
        </Text>
      ))}
    </View>
  );
}

function Intelligence() {
  const { getToken } = useAuth();
  const [view, setView] = useState<PortfolioView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [gated, setGated] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const row = await apiFetch<PortfolioView | null>("/api/v1/portfolio/analysis", token);
      if (row) setView(row);
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
    setMessage(null);
    try {
      const token = await getToken();
      const r = await apiFetch<GenResult>("/api/v1/portfolio/analysis", token, { method: "POST" });
      if (r.status === "scored") setView(r.analysis);
      else setMessage(r.message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to analyze";
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
        <Text style={styles.upgradeTitle}>Portfolio Intelligence is an Investor feature.</Text>
        <Text style={styles.upgradeBody}>
          Upgrade to get health, risk, diversification and cash scores plus sector breakdowns.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, gap: 12 }}>
      <Pressable onPress={refresh} disabled={busy} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>{busy ? "Analyzing…" : view ? "Refresh analysis" : "Generate analysis"}</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
      {message && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {message} Connect a brokerage and sync at least 3 holdings.
          </Text>
        </View>
      )}

      {view ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
          <View style={styles.tiles}>
            <ScoreTile label="Health" value={view.healthScore} />
            <ScoreTile label="Diversification" value={view.diversificationScore} />
            <ScoreTile label="Risk" value={view.riskScore} />
            <ScoreTile label="Cash" value={view.cashScore} />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={styles.fieldTitle}>Sector concentration</Text>
            {view.sectorConcentration.length === 0 ? (
              <Text style={styles.hint}>No sector data.</Text>
            ) : (
              view.sectorConcentration.map((s) => (
                <View key={s.sector} style={styles.sectorRow}>
                  <Text style={styles.sectorName}>{s.sector}</Text>
                  <Text style={styles.sectorPct}>{Math.round(s.pct)}%</Text>
                </View>
              ))
            )}
          </View>

          <Bullets title="Strengths" items={view.strengths} color="#15803d" />
          <Bullets title="Weaknesses" items={view.weaknesses} color="#b91c1c" />
          <Bullets title="Suggested focus" items={view.improvements} color="#1d4ed8" />

          <Text style={styles.disclaimer}>
            Deterministic scoring from your stored holdings — educational only.
          </Text>
        </ScrollView>
      ) : (
        !message && <Text style={styles.hint}>Generate an analysis to see your portfolio health.</Text>
      )}
    </View>
  );
}

export default function PortfolioScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Link href="/" style={styles.back}>
        ← Home
      </Link>
      <Text style={styles.h1}>Portfolio Intelligence</Text>
      <SignedIn>
        <Intelligence />
      </SignedIn>
      <SignedOut>
        <Text style={styles.hint}>Sign in to see your portfolio health.</Text>
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
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { flexBasis: "47%", flexGrow: 1, borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 10, padding: 12, alignItems: "center" },
  tileLabel: { fontSize: 12, color: "#888" },
  tileValue: { fontSize: 24, fontWeight: "700", color: "#111" },
  fieldTitle: { fontWeight: "600", fontSize: 14 },
  bullet: { fontSize: 13, color: "#374151", lineHeight: 19 },
  sectorRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  sectorName: { fontSize: 13, color: "#374151" },
  sectorPct: { fontSize: 13, fontWeight: "600" },
  notice: { backgroundColor: "#fffbeb", borderColor: "#fde68a", borderWidth: 1, borderRadius: 8, padding: 12 },
  noticeText: { color: "#92400e", fontSize: 13 },
  upgrade: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe", borderWidth: 1, borderRadius: 10, padding: 16, gap: 6 },
  upgradeTitle: { fontWeight: "700", color: "#1e40af" },
  upgradeBody: { color: "#1e40af", fontSize: 13 },
  hint: { fontSize: 13, color: "#888" },
  error: { color: "#b91c1c", fontSize: 13 },
  disclaimer: { fontSize: 11, color: "#999", marginTop: 4 },
});
