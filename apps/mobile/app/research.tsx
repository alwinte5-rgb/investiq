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

interface ArticleWithImpact {
  id: string;
  source: string;
  url: string;
  headline: string;
  summary: string | null;
  publishedAt: string;
  impact: { impact: string; rationale: string; confidence: number } | null;
}
const IMPACT_LABEL: Record<string, string> = { POSITIVE: "Positive", NEUTRAL: "Neutral", NEGATIVE: "Negative" };
const IMPACT_COLOR: Record<string, string> = { POSITIVE: "#15803d", NEUTRAL: "#6b7280", NEGATIVE: "#b91c1c" };

interface RiskView {
  status: "assessed" | "insufficient";
  message?: string;
  buyZoneLow?: number;
  buyZoneHigh?: number;
  stopLoss?: number;
  profitTarget?: number;
  riskReward?: number;
  positionSize?: number | null;
  warningColor?: "GREEN" | "YELLOW" | "ORANGE" | "RED";
  warnings?: { severity: "info" | "warn"; message: string }[];
}
const RISK_LABEL: Record<string, string> = { GREEN: "Low risk", YELLOW: "Watch", ORANGE: "Elevated", RED: "High risk" };
const RISK_COLOR: Record<string, string> = { GREEN: "#15803d", YELLOW: "#b45309", ORANGE: "#c2410c", RED: "#b91c1c" };
const money = (v?: number | null) =>
  v == null ? "—" : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
// Tickers whose news was auto-pulled this app session (avoid re-ingesting).
const autoNewsDone = new Set<string>();

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
  const [analyzedTicker, setAnalyzedTicker] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [news, setNews] = useState<ArticleWithImpact[] | null>(null);
  const [newsGated, setNewsGated] = useState(false);
  const [newsBusy, setNewsBusy] = useState(false);
  const [risk, setRisk] = useState<RiskView | null>(null);
  const [riskBusy, setRiskBusy] = useState(false);

  async function assessRisk(t: string) {
    setRiskBusy(true);
    try {
      const token = await getToken();
      setRisk(await apiFetch<RiskView>(`/api/v1/symbols/${t}/risk`, token, { method: "POST" }));
    } catch {
      /* non-critical */
    } finally {
      setRiskBusy(false);
    }
  }

  async function loadNews(t: string, refresh = false) {
    setNewsBusy(true);
    setNewsGated(false);
    try {
      const token = await getToken();
      if (refresh) {
        await apiFetch(`/api/v1/symbols/${t}/news/refresh`, token, { method: "POST" });
      }
      setNews(await apiFetch<ArticleWithImpact[]>(`/api/v1/symbols/${t}/news`, token));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/\b403\b|investor plan|forbidden/i.test(msg)) setNewsGated(true);
    } finally {
      setNewsBusy(false);
    }
  }

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
    setNews(null);
    setRisk(null);
    setAnalyzedTicker(t);
    try {
      const token = await getToken();
      const r = await apiFetch<Result>("/api/v1/analysis", token, {
        method: "POST",
        body: JSON.stringify({ ticker: t }),
      });
      setResult(r);
      // Run risk + news together with the analysis (news pulled fresh once per
      // ticker per session).
      void assessRisk(t);
      void loadNews(t, !autoNewsDone.has(t));
      autoNewsDone.add(t);
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

          <View style={styles.newsHeader}>
            <Text style={styles.fieldTitle}>Risk & levels</Text>
            <Pressable
              onPress={() => analyzedTicker && assessRisk(analyzedTicker)}
              disabled={riskBusy || !analyzedTicker}
            >
              <Text style={[styles.newsRefresh, riskBusy && styles.btnDisabled]}>
                {riskBusy ? "…" : "Re-assess"}
              </Text>
            </Pressable>
          </View>
          {risk?.status === "assessed" ? (
            <View style={styles.newsItem}>
              <Text style={[styles.newsBadge, { color: RISK_COLOR[risk.warningColor ?? "GREEN"] }]}>
                {RISK_LABEL[risk.warningColor ?? "GREEN"]}
              </Text>
              <Text style={styles.riskStat}>
                Buy {money(risk.buyZoneLow)}–{money(risk.buyZoneHigh)} · Stop {money(risk.stopLoss)} ·
                Target {money(risk.profitTarget)}
              </Text>
              <Text style={styles.riskStat}>
                Reward:risk {risk.riskReward}:1
                {risk.positionSize != null ? ` · Size ${risk.positionSize} sh` : ""}
              </Text>
              {risk.warnings?.map((w, i) => (
                <Text key={i} style={styles.newsRationale}>
                  {w.severity === "warn" ? "⚠ " : "• "}
                  {w.message}
                </Text>
              ))}
            </View>
          ) : risk?.status === "insufficient" ? (
            <Text style={styles.hint}>{risk.message}</Text>
          ) : (
            <Text style={styles.hint}>{riskBusy ? "Assessing risk…" : "—"}</Text>
          )}

          <View style={styles.newsHeader}>
            <Text style={styles.fieldTitle}>News & impact</Text>
            {!newsGated && (
              <Pressable
                onPress={() => analyzedTicker && loadNews(analyzedTicker, true)}
                disabled={newsBusy || !analyzedTicker}
              >
                <Text style={[styles.newsRefresh, newsBusy && styles.btnDisabled]}>
                  {newsBusy ? "…" : "Refresh"}
                </Text>
              </Pressable>
            )}
          </View>
          {newsGated ? (
            <Text style={styles.hint}>News Intelligence is an Investor feature.</Text>
          ) : !news || news.length === 0 ? (
            <Text style={styles.hint}>No classified news yet — tap Refresh to pull headlines.</Text>
          ) : (
            news.map((n) => (
              <View key={n.id} style={styles.newsItem}>
                <View style={styles.newsTop}>
                  <Text style={styles.newsHeadline}>{n.headline}</Text>
                  {n.impact && (
                    <Text style={[styles.newsBadge, { color: IMPACT_COLOR[n.impact.impact] ?? "#6b7280" }]}>
                      {IMPACT_LABEL[n.impact.impact] ?? n.impact.impact} · {n.impact.confidence}
                    </Text>
                  )}
                </View>
                {n.impact?.rationale ? <Text style={styles.newsRationale}>{n.impact.rationale}</Text> : null}
              </View>
            ))
          )}
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
  newsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  newsRefresh: { color: "#2563eb", fontWeight: "600", fontSize: 13 },
  newsItem: { borderWidth: 1, borderColor: "#eee", borderRadius: 8, padding: 10, gap: 3 },
  newsTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  newsHeadline: { fontSize: 13, color: "#1f2937", flex: 1, fontWeight: "500" },
  newsBadge: { fontSize: 11, fontWeight: "700" },
  newsRationale: { fontSize: 12, color: "#4b5563" },
  riskStat: { fontSize: 12, color: "#374151" },
});
