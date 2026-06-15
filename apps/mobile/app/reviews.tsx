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

type Period = "MORNING" | "WEEKLY" | "MONTHLY";
const PERIODS: { key: Period; label: string }[] = [
  { key: "MORNING", label: "Morning" },
  { key: "WEEKLY", label: "Weekly" },
  { key: "MONTHLY", label: "Monthly" },
];

interface Flag {
  type: string;
  severity: "info" | "warn";
  title: string;
  detail: string;
}
interface ReviewContent {
  headline: string;
  summary: string;
  healthScore: number;
  riskScore: number;
  diversificationScore: number;
  cashScore: number;
  flags: Flag[];
}
interface StoredReview {
  id: string;
  period: Period;
  content: ReviewContent;
  generatedAt: string;
}
type GenResult =
  | { status: "created" | "exists"; review: StoredReview; content?: ReviewContent }
  | { status: "insufficient"; message: string };

function Reviewer() {
  const { getToken } = useAuth();
  const [period, setPeriod] = useState<Period>("MORNING");
  const [content, setContent] = useState<ReviewContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [gated, setGated] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const row = await apiFetch<StoredReview | null>("/api/v1/portfolio/reviews", token);
      if (row) {
        setContent(row.content);
        setPeriod(row.period);
      } else {
        // Auto-generate today's briefing if none is stored — no manual Generate.
        try {
          const gen = await apiFetch<GenResult>("/api/v1/portfolio/reviews?period=MORNING", token, {
            method: "POST",
          });
          if (gen.status !== "insufficient") setContent(gen.content ?? gen.review.content);
          else setMessage(gen.message);
        } catch {
          /* leave empty — UI shows guidance */
        }
      }
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

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      const r = await apiFetch<GenResult>(`/api/v1/portfolio/reviews?period=${period}`, token, {
        method: "POST",
      });
      if (r.status === "insufficient") setMessage(r.message);
      else setContent(r.content ?? r.review.content);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate";
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
        <Text style={styles.upgradeTitle}>Reviews & briefings are an Investor feature.</Text>
        <Text style={styles.upgradeBody}>
          Upgrade for morning briefings plus weekly and monthly portfolio reviews.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, gap: 12 }}>
      <View style={styles.tabs}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => setPeriod(p.key)}
            style={[styles.tab, period === p.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, period === p.key && styles.tabTextActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={generate} disabled={busy} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>{busy ? "Generating…" : "Generate now"}</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
      {message && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {message} Connect a brokerage and sync your holdings, or try sample data.
          </Text>
        </View>
      )}

      {content ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
          <Text style={styles.headline}>{content.headline}</Text>
          <Text style={styles.summary}>{content.summary}</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.score}>Health {content.healthScore}</Text>
            <Text style={styles.score}>Risk {content.riskScore}</Text>
            <Text style={styles.score}>Div {content.diversificationScore}</Text>
            <Text style={styles.score}>Cash {content.cashScore}</Text>
          </View>
          {content.flags.map((f, i) => (
            <View
              key={i}
              style={[styles.flag, f.severity === "warn" ? styles.flagWarn : styles.flagInfo]}
            >
              <Text style={styles.flagTitle}>{f.title}</Text>
              <Text style={styles.flagDetail}>{f.detail}</Text>
            </View>
          ))}
          <Text style={styles.disclaimer}>Educational only — not investment advice.</Text>
        </ScrollView>
      ) : (
        !message && <Text style={styles.hint}>Pick a period and generate a review.</Text>
      )}
    </View>
  );
}

export default function ReviewsScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topRow}>
        <Link href="/" style={styles.back}>
          ← Home
        </Link>
        <Link href="/settings" style={styles.back}>
          Settings →
        </Link>
      </View>
      <Text style={styles.h1}>Reviews & briefings</Text>
      <SignedIn>
        <Reviewer />
      </SignedIn>
      <SignedOut>
        <Text style={styles.hint}>Sign in to see your reviews.</Text>
      </SignedOut>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 12 },
  topRow: { flexDirection: "row", justifyContent: "space-between" },
  back: { color: "#2563eb", fontWeight: "600" },
  h1: { fontSize: 22, fontWeight: "600" },
  tabs: { flexDirection: "row", borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 8, padding: 3, gap: 3 },
  tab: { flex: 1, paddingVertical: 7, borderRadius: 6, alignItems: "center" },
  tabActive: { backgroundColor: "#2563eb" },
  tabText: { fontSize: 13, color: "#555", fontWeight: "600" },
  tabTextActive: { color: "white" },
  btn: { backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "white", fontWeight: "600" },
  headline: { fontSize: 16, fontWeight: "700" },
  summary: { fontSize: 14, color: "#374151", lineHeight: 20 },
  scoreRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  score: { fontSize: 13, fontWeight: "600", color: "#444" },
  flag: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 2 },
  flagWarn: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  flagInfo: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  flagTitle: { fontWeight: "600", fontSize: 13, color: "#1f2937" },
  flagDetail: { fontSize: 12, color: "#4b5563" },
  notice: { backgroundColor: "#fffbeb", borderColor: "#fde68a", borderWidth: 1, borderRadius: 8, padding: 12 },
  noticeText: { color: "#92400e", fontSize: 13 },
  upgrade: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe", borderWidth: 1, borderRadius: 10, padding: 16, gap: 6 },
  upgradeTitle: { fontWeight: "700", color: "#1e40af" },
  upgradeBody: { color: "#1e40af", fontSize: 13 },
  hint: { fontSize: 13, color: "#888" },
  error: { color: "#b91c1c", fontSize: 13 },
  disclaimer: { fontSize: 11, color: "#999", marginTop: 4 },
});
