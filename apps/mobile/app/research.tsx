import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SignedIn, SignedOut, useAuth } from "@clerk/clerk-expo";
import { Link, useLocalSearchParams } from "expo-router";
import { apiFetch } from "../lib/api";

const REC_LABELS: Record<string, string> = {
  STRONG_BUY_WATCH: "Strong Buy Watch",
  BUY_WATCH: "Buy Watch",
  HOLD: "Hold",
  TRIM_POSITION: "Trim Position",
  EXIT_CONSIDERATION: "Exit Consideration",
  HIGH_RISK_WARNING: "High Risk Warning",
  AVOID: "Avoid",
  REBUY_WATCH: "Rebuy Watch",
};

interface Evidence {
  id: string;
  sourceType: string;
  role: "SUPPORTING" | "INVALIDATING";
  snapshot: { note?: string } | null;
}
interface Analysis {
  id: string;
  recommendationType: string;
  summary: string;
  bullCase: string | null;
  bearCase: string | null;
  keyRisks: string | null;
  confidenceScore: number;
  riskScore: number;
  model: string;
  generatedAt: string;
  evidence: Evidence[];
}
type Result =
  | { status: "created" | "cached"; analysis: Analysis }
  | { status: "insufficient"; message: string };

function Field({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.fieldTitle}>{title}</Text>
      <Text style={styles.fieldBody}>{body}</Text>
    </View>
  );
}

function Researcher() {
  const { getToken } = useAuth();
  const params = useLocalSearchParams<{ ticker?: string }>();
  const [ticker, setTicker] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-run when arriving from a "Analyze" link (e.g. /research?ticker=AAPL).
  useEffect(() => {
    const t = (params.ticker ?? "").toString().trim().toUpperCase();
    if (t) {
      setTicker(t);
      void analyze(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.ticker]);

  async function analyze(override?: string) {
    const t = (override ?? ticker).trim().toUpperCase();
    if (!t || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = await getToken();
      const r = await apiFetch<Result>("/api/v1/analysis", token, {
        method: "POST",
        body: JSON.stringify({ ticker: t }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  const a = result && result.status !== "insufficient" ? result.analysis : null;

  return (
    <View style={{ flex: 1, gap: 12 }}>
      <View style={styles.row}>
        <TextInput
          value={ticker}
          onChangeText={(v) => setTicker(v.toUpperCase())}
          placeholder="Ticker (e.g. AAPL)"
          autoCapitalize="characters"
          style={styles.input}
        />
        <Pressable
          onPress={() => analyze()}
          disabled={loading || !ticker.trim()}
          style={[styles.btn, (loading || !ticker.trim()) && styles.btnDisabled]}
        >
          <Text style={styles.btnText}>{loading ? "…" : "Analyze"}</Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 16 }} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {result?.status === "insufficient" && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{result.message}</Text>
        </View>
      )}

      {a && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
          <View style={styles.badgeRow}>
            <Text style={styles.badge}>{REC_LABELS[a.recommendationType] ?? a.recommendationType}</Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.score}>Confidence {a.confidenceScore}/100</Text>
            <Text style={styles.score}>Risk {a.riskScore}/100</Text>
          </View>
          <Field title="Summary" body={a.summary} />
          <Field title="Bull case" body={a.bullCase} />
          <Field title="Bear case" body={a.bearCase} />
          <Field title="Key risks" body={a.keyRisks} />
          {a.evidence.length > 0 && (
            <View style={{ gap: 2 }}>
              <Text style={styles.fieldTitle}>Evidence ({a.evidence.length})</Text>
              {a.evidence.map((e) => (
                <Text key={e.id} style={styles.evidence}>
                  {e.role === "SUPPORTING" ? "✓" : "⚠"} {e.sourceType}
                  {e.snapshot?.note ? ` — ${e.snapshot.note}` : ""}
                </Text>
              ))}
            </View>
          )}
          <Text style={styles.disclaimer}>
            Educational research only — not investment advice. Grounded in the evidence above.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

export default function ResearchScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Link href="/" style={styles.back}>
        ← Home
      </Link>
      <Text style={styles.h1}>Research</Text>
      <SignedIn>
        <Researcher />
      </SignedIn>
      <SignedOut>
        <Text style={styles.hint}>Sign in to research US stocks and ETFs.</Text>
      </SignedOut>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 12 },
  back: { color: "#2563eb", fontWeight: "600" },
  h1: { fontSize: 22, fontWeight: "600" },
  row: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  btn: { backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 14, justifyContent: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "white", fontWeight: "600" },
  badgeRow: { flexDirection: "row" },
  badge: { backgroundColor: "#eff6ff", color: "#1d4ed8", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, fontWeight: "700", overflow: "hidden" },
  scoreRow: { flexDirection: "row", gap: 16 },
  score: { fontSize: 13, fontWeight: "600", color: "#444" },
  fieldTitle: { fontWeight: "600", fontSize: 14, marginTop: 4 },
  fieldBody: { fontSize: 14, color: "#374151", lineHeight: 20 },
  evidence: { fontSize: 12, color: "#555" },
  notice: { backgroundColor: "#fffbeb", borderColor: "#fde68a", borderWidth: 1, borderRadius: 8, padding: 12 },
  noticeText: { color: "#92400e", fontSize: 13 },
  hint: { fontSize: 13, color: "#888" },
  error: { color: "#b91c1c", fontSize: 13 },
  disclaimer: { fontSize: 11, color: "#999", marginTop: 8 },
});
