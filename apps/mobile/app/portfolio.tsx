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
import { colors } from "../lib/theme";

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
  holdingsCount?: number;
}
type GenResult =
  | { status: "scored"; analysis: PortfolioView }
  | { status: "insufficient"; message: string };

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const BAR_GREEN = "#10b981";
const BAR_AMBER = "#f59e0b";
const BAR_RED = "#ef4444";

function healthLabel(v: number): string {
  return v >= 80 ? "Excellent" : v >= 65 ? "Good" : v >= 45 ? "Fair" : "Needs attention";
}
function healthStroke(v: number): string {
  return v >= 80 ? BAR_GREEN : v >= 65 ? "#3b82f6" : v >= 45 ? BAR_AMBER : BAR_RED;
}

/** Apple-Health-style score ring (full colored ring; RN has no native arc). */
function ScoreRing({ value }: { value: number }) {
  const v = clamp(value);
  return (
    <View style={[styles.ring, { borderColor: healthStroke(v) }]}>
      <Text style={styles.ringValue}>{v}</Text>
      <Text style={styles.ringSuffix}>/ 100</Text>
    </View>
  );
}

/** One labelled progress bar. `invert` (risk): low value is good. */
function MetricBar({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const v = clamp(value);
  const good = invert ? v <= 40 : v >= 60;
  const mid = invert ? v > 40 && v <= 60 : v >= 40 && v < 60;
  const color = good ? BAR_GREEN : mid ? BAR_AMBER : BAR_RED;
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>
          {v}
          <Text style={styles.barValueSuffix}>/100</Text>
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${v}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function Narrative({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={[styles.narrTitle, { color }]}>{title}</Text>
      {items.map((it, i) => (
        <Text key={i} style={styles.bullet}>
          • {it}
        </Text>
      ))}
    </View>
  );
}

function Report({ v }: { v: PortfolioView }) {
  return (
    <View style={{ gap: 14 }}>
      {/* Health hero: ring + bars */}
      <View style={styles.card}>
        <View style={styles.heroRow}>
          <View style={styles.ringCol}>
            <ScoreRing value={v.healthScore} />
            <Text style={styles.healthLabel}>{healthLabel(v.healthScore)}</Text>
            <Text style={styles.caption}>Portfolio health</Text>
          </View>
          <View style={styles.bars}>
            <MetricBar label="Diversification" value={v.diversificationScore} />
            <MetricBar label="Risk" value={v.riskScore} invert />
            <MetricBar label="Cash buffer" value={v.cashScore} />
          </View>
        </View>
        <Text style={styles.heroCaption}>
          {new Date(v.generatedAt).toLocaleString()}
          {v.holdingsCount != null ? ` · ${v.holdingsCount} holdings` : ""} · Deterministic scoring
          from your holdings — educational only, not advice.
        </Text>
      </View>

      {/* Recommendations */}
      {v.improvements.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recommendations</Text>
          {v.improvements.map((it, i) => (
            <View key={i} style={styles.recRow}>
              <Text style={styles.recCheck}>✓</Text>
              <Text style={styles.recText}>{it}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Strengths + watch-outs */}
      {(v.strengths.length > 0 || v.weaknesses.length > 0) && (
        <View style={[styles.card, styles.narrRow]}>
          <Narrative title="Strengths" items={v.strengths} color={colors.green700} />
          <Narrative title="Watch-outs" items={v.weaknesses} color={colors.red700} />
        </View>
      )}

      {/* Sector mix */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sector mix</Text>
        {v.sectorConcentration.length === 0 ? (
          <Text style={styles.caption}>No sector data.</Text>
        ) : (
          v.sectorConcentration.map((s) => (
            <View key={s.sector} style={{ gap: 4 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectorName}>{s.sector}</Text>
                <Text style={styles.sectorPct}>{Math.round(s.pct)}%</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.max(0, Math.min(100, s.pct))}%`, backgroundColor: "#3b82f6" },
                  ]}
                />
              </View>
            </View>
          ))
        )}
        {(v.overweight.length > 0 || v.underweight.length > 0) && (
          <View style={styles.weightWrap}>
            {v.overweight.map((s) => (
              <Text key={`o${s.sector}`} style={[styles.weightChip, styles.overweight]}>
                Overweight {s.sector} {Math.round(s.pct)}%
              </Text>
            ))}
            {v.underweight.map((s) => (
              <Text key={`u${s.sector}`} style={[styles.weightChip, styles.underweight]}>
                Underweight {s.sector} {Math.round(s.pct)}%
              </Text>
            ))}
          </View>
        )}
      </View>
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
        <Text style={styles.upgradeTitle}>Portfolio health is an Investor feature.</Text>
        <Text style={styles.upgradeBody}>
          Upgrade to get health, risk, diversification and cash scores plus sector mix and focus
          recommendations.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 28 }}>
      <Pressable onPress={refresh} disabled={busy} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>
          {busy ? "Analyzing…" : view ? "Refresh report" : "Generate report"}
        </Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
      {message && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {message} Connect a brokerage and sync your holdings, or try sample data.
          </Text>
        </View>
      )}

      {view ? (
        <Report v={view} />
      ) : (
        !message && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Generate a report to see your portfolio health, risk and diversification.
            </Text>
          </View>
        )
      )}
    </ScrollView>
  );
}

export default function PortfolioScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Link href="/" style={styles.back}>
        ← Home
      </Link>
      <Text style={styles.h1}>Portfolio health</Text>
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
  back: { color: colors.blue, fontWeight: "600" },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink },
  hint: { fontSize: 13, color: colors.slate500 },
  caption: { fontSize: 11, color: colors.slate400 },
  error: { color: colors.red700, fontSize: 13 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  btn: { backgroundColor: colors.blue, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700" },

  card: { borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 14, padding: 16, gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: colors.ink },

  heroRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  ringCol: { alignItems: "center", gap: 2 },
  ring: { width: 110, height: 110, borderRadius: 55, borderWidth: 11, alignItems: "center", justifyContent: "center" },
  ringValue: { fontSize: 30, fontWeight: "800", color: colors.ink },
  ringSuffix: { fontSize: 10, color: colors.slate400, marginTop: -2 },
  healthLabel: { fontSize: 13, fontWeight: "700", color: colors.slate700, marginTop: 4 },
  bars: { flex: 1, gap: 10 },
  barLabel: { fontSize: 12, fontWeight: "600", color: colors.slate600 },
  barValue: { fontSize: 12, fontWeight: "700", color: colors.slate800 },
  barValueSuffix: { color: colors.slate400, fontWeight: "400" },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.slate100, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  heroCaption: { fontSize: 11, color: colors.slate400, borderTopWidth: 1, borderTopColor: colors.slate100, paddingTop: 8, lineHeight: 16 },

  recRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  recCheck: { color: BAR_GREEN, fontSize: 14, marginTop: 1 },
  recText: { flex: 1, fontSize: 13, color: colors.slate700, lineHeight: 19 },

  narrRow: { flexDirection: "row", gap: 16 },
  narrTitle: { fontSize: 13, fontWeight: "700" },
  bullet: { fontSize: 13, color: colors.slate700, lineHeight: 18 },

  sectorName: { fontSize: 13, color: colors.slate600 },
  sectorPct: { fontSize: 13, fontWeight: "600", color: colors.slate800 },
  weightWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, borderTopWidth: 1, borderTopColor: colors.slate100, paddingTop: 10, marginTop: 2 },
  weightChip: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: "hidden" },
  overweight: { backgroundColor: colors.amber50, color: colors.amber700 },
  underweight: { backgroundColor: colors.blue50, color: colors.blue700 },

  notice: { backgroundColor: colors.amber50, borderColor: "#fde68a", borderWidth: 1, borderRadius: 10, padding: 12 },
  noticeText: { color: colors.amber700, fontSize: 13, lineHeight: 18 },
  upgrade: { backgroundColor: colors.blue50, borderColor: colors.blue200, borderWidth: 1, borderRadius: 14, padding: 16, gap: 6 },
  upgradeTitle: { fontWeight: "700", color: colors.blue700 },
  upgradeBody: { color: colors.blue700, fontSize: 13, lineHeight: 18 },
  empty: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.slate300, borderRadius: 14, padding: 16 },
  emptyText: { fontSize: 13, color: colors.slate500, textAlign: "center", lineHeight: 19 },
});
