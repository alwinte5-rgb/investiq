import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
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
import { Term } from "../components/glossary";
import { colors } from "../lib/theme";

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

interface ChartLevel {
  kind: "BUY_ZONE_LOW" | "BUY_ZONE_HIGH" | "STOP_LOSS" | "PROFIT_TARGET";
  price: number;
  label: string;
  color: string;
}
interface ChartEvent {
  kind: "EARNINGS" | "NEWS";
  date: string;
  label: string;
  tone?: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  url?: string;
}
interface ShowMeWhyItem {
  sourceType: string;
  role: "SUPPORTING" | "INVALIDATING";
  note: string | null;
}
interface ChartOverlay {
  ticker: string;
  levels: ChartLevel[];
  events: ChartEvent[];
  showMeWhy: ShowMeWhyItem[];
  hasRisk: boolean;
  hasAnalysis: boolean;
}
interface LearningContent {
  slug: string;
  title: string;
  body: string;
  tags: string[];
}
interface Scorecard {
  ticker: string;
  financialStrength: number | null;
  marketCap: number | null;
  pe: number | null;
  roe: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
}
interface CompanyFiling {
  form: string;
  filingDate: string;
  url: string;
}
interface CompanyFilings {
  ticker: string;
  cik: string;
  name: string;
  edgarUrl: string;
  filings: CompanyFiling[];
}
const pct = (n: number | null | undefined) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);
function strengthColor(v: number | null): string {
  if (v == null) return colors.slate400;
  return v >= 80 ? colors.green : v >= 60 ? colors.blue : v >= 40 ? colors.amber : colors.red;
}
function strengthLabel(v: number): string {
  return v >= 80 ? "Excellent" : v >= 60 ? "Good" : v >= 40 ? "Fair" : "Weak";
}
function ScStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.scStat}>
      <Text style={styles.scStatLabel}>{label}</Text>
      <Text style={styles.scStatValue}>{value}</Text>
    </View>
  );
}
interface Mover {
  ticker: string;
  price: number;
  change: number | null;
  changePct: number | null;
}
interface MarketMovers {
  gainers: Mover[];
  losers: Mover[];
  asOf: string;
}
const TONE_COLOR: Record<string, string> = { POSITIVE: "#15803d", NEUTRAL: "#6b7280", NEGATIVE: "#b91c1c" };
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  const [chart, setChart] = useState<ChartOverlay | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [learn, setLearn] = useState<LearningContent[]>([]);
  const [openLearn, setOpenLearn] = useState<string | null>(null);
  const [movers, setMovers] = useState<MarketMovers | null>(null);
  const [popular, setPopular] = useState<Mover[]>([]);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  // undefined = not loaded yet · null = loaded, ticker isn't an EDGAR filer.
  const [filings, setFilings] = useState<CompanyFilings | null | undefined>(undefined);

  // Movers + a curated popular fallback, loaded once. Best-effort — popular
  // ensures there are ALWAYS suggestions even when movers are unavailable.
  useEffect(() => {
    let active = true;
    (async () => {
      const token = await getToken().catch(() => null);
      const [m, p] = await Promise.all([
        apiFetch<MarketMovers>("/api/v1/market/movers", token).catch(() => null),
        apiFetch<Mover[]>("/api/v1/market/popular", token).catch(() => [] as Mover[]),
      ]);
      if (active) {
        setMovers(m);
        setPopular(p);
      }
    })();
    return () => {
      active = false;
    };
  }, [getToken]);

  async function loadLearning(recType: string) {
    try {
      const token = await getToken();
      setLearn(
        await apiFetch<LearningContent[]>(
          `/api/v1/learning/recommendation/${encodeURIComponent(recType)}`,
          token,
        ),
      );
    } catch {
      /* educational content is non-critical */
    }
  }

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

  async function loadChart(t: string) {
    try {
      const token = await getToken();
      setChart(await apiFetch<ChartOverlay>(`/api/v1/symbols/${t}/chart`, token));
    } catch {
      /* chart overlay is non-critical */
    }
  }

  async function loadScorecard(t: string) {
    try {
      const token = await getToken();
      setScorecard(await apiFetch<Scorecard>(`/api/v1/symbols/${t}/scorecard`, token));
    } catch {
      /* scorecard is non-critical */
    }
  }

  async function loadFilings(t: string) {
    try {
      const token = await getToken();
      setFilings(await apiFetch<CompanyFilings | null>(`/api/v1/filings/${t}`, token));
    } catch {
      /* filings are non-critical */
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
    setChart(null);
    setShowWhy(false);
    setLearn([]);
    setOpenLearn(null);
    setScorecard(null);
    setFilings(undefined);
    setAnalyzedTicker(t);
    try {
      const token = await getToken();
      const r = await apiFetch<Result>("/api/v1/analysis", token, {
        method: "POST",
        body: JSON.stringify({ ticker: t }),
      });
      setResult(r);
      // Run risk + news together with the analysis (news pulled fresh once per
      // ticker per session). Chart overlay loads after risk so it reflects the
      // freshly stored levels.
      void assessRisk(t).then(() => loadChart(t));
      void loadNews(t, !autoNewsDone.has(t));
      autoNewsDone.add(t);
      // Factual scorecard + primary-source filings (both non-critical, self-hide).
      void loadScorecard(t);
      void loadFilings(t);
      // Inline education tied to the recommendation type (Layer 10).
      if (r.status !== "insufficient") void loadLearning(r.analysis.recommendationType);
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

      {!a && !loading && (() => {
        const hasMovers = !!movers && (movers.gainers.length > 0 || movers.losers.length > 0);
        if (!hasMovers && popular.length === 0) return null;
        const row = (m: Mover) => (
          <Pressable
            key={m.ticker}
            onPress={() => {
              setTicker(m.ticker);
              void analyze(m.ticker);
            }}
            style={styles.moverRow}
          >
            <Text style={styles.moverTicker}>{m.ticker}</Text>
            <Text style={styles.moverPrice}>${m.price.toFixed(2)}</Text>
            <Text style={[styles.moverPct, { color: (m.changePct ?? 0) >= 0 ? "#15803d" : "#b91c1c" }]}>
              {m.changePct == null ? "—" : `${m.changePct >= 0 ? "+" : ""}${m.changePct.toFixed(2)}%`}
            </Text>
          </Pressable>
        );
        return (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
            <Text style={styles.moversTitle}>{hasMovers ? "Today’s movers" : "Popular to research"}</Text>
            <Text style={styles.moversHint}>
              {hasMovers
                ? "Top US gainers and losers — tap any ticker to analyze it."
                : "Widely-held US stocks & ETFs — tap any ticker to analyze it."}
            </Text>
            {hasMovers
              ? (["gainers", "losers"] as const).map((dir) => (
                  <View key={dir} style={{ gap: 2 }}>
                    <Text style={styles.fieldTitle}>
                      {dir === "gainers" ? "📈 Top gainers" : "📉 Top losers"}
                    </Text>
                    {movers![dir].map(row)}
                  </View>
                ))
              : popular.map(row)}
          </ScrollView>
        );
      })()}

      {a && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
          <View style={styles.badgeRow}>
            <Text style={styles.badge}>
              <Term k={a.recommendationType}>
                {REC_LABELS[a.recommendationType] ?? a.recommendationType}
              </Term>
            </Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.score}>
              <Term k="confidence score">Confidence</Term> {a.confidenceScore}/100
            </Text>
            <Text style={styles.score}>
              <Term k="risk score">Risk</Term> {a.riskScore}/100
            </Text>
          </View>
          {(() => {
            const reasons = a.evidence.filter((e) => e.role === "SUPPORTING" && e.snapshot?.note).slice(0, 3);
            if (reasons.length === 0) return null;
            return (
              <View style={styles.verdictBox}>
                <Text style={styles.verdictTitle}>Top reasons</Text>
                {reasons.map((e) => (
                  <Text key={e.id} style={styles.verdictReason}>
                    ✓ {e.snapshot?.note}
                  </Text>
                ))}
              </View>
            );
          })()}
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

          {learn.length > 0 && (
            <View style={styles.learnBox}>
              <Text style={styles.learnTitle}>📘 Learn the concepts</Text>
              <Text style={styles.learnIntro}>
                Background to help you interpret this for yourself — not advice.
              </Text>
              {learn.map((c) => (
                <View key={c.slug} style={styles.learnItem}>
                  <Pressable onPress={() => setOpenLearn((s) => (s === c.slug ? null : c.slug))}>
                    <Text style={styles.learnItemTitle}>
                      {openLearn === c.slug ? "– " : "+ "}
                      {c.title}
                    </Text>
                  </Pressable>
                  {openLearn === c.slug && <Text style={styles.learnBody}>{c.body}</Text>}
                </View>
              ))}
            </View>
          )}

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
                <Term k="buy zone">Buy</Term> {money(risk.buyZoneLow)}–{money(risk.buyZoneHigh)} ·{" "}
                <Term k="stop loss">Stop</Term> {money(risk.stopLoss)} ·{" "}
                <Term k="profit target">Target</Term> {money(risk.profitTarget)}
              </Text>
              <Text style={styles.riskStat}>
                <Term k="reward : risk">Reward:risk</Term> {risk.riskReward}:1
                {risk.positionSize != null ? (
                  <>
                    {" · "}
                    <Term k="position sizing">Size</Term> {risk.positionSize} sh
                  </>
                ) : (
                  ""
                )}
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

          <Text style={styles.fieldTitle}>Chart & levels</Text>
          {!chart || (!chart.hasRisk && !chart.hasAnalysis) ? (
            <Text style={styles.hint}>Run analysis + risk to see levels and the evidence behind them.</Text>
          ) : (
            <View style={styles.newsItem}>
              {chart.levels.map((l) => (
                <View key={l.kind} style={styles.levelRow}>
                  <View style={styles.levelLeft}>
                    <View style={[styles.levelLine, { backgroundColor: l.color }]} />
                    <Text style={styles.levelLabel}>{l.label}</Text>
                  </View>
                  <Text style={[styles.levelPrice, { color: l.color }]}>{money(l.price)}</Text>
                </View>
              ))}
              {chart.events.length > 0 && (
                <View style={styles.chartEvents}>
                  {chart.events.map((e, i) => (
                    <Text key={i} style={styles.eventRow}>
                      <Text style={styles.eventDate}>{fmtDate(e.date)} </Text>
                      {e.kind === "EARNINGS" ? (
                        <Text style={styles.riskStat}>📅 {e.label}</Text>
                      ) : (
                        <Text style={{ color: TONE_COLOR[e.tone ?? "NEUTRAL"] }}>📰 {e.label}</Text>
                      )}
                    </Text>
                  ))}
                </View>
              )}
              {chart.showMeWhy.length > 0 && (
                <View>
                  <Pressable onPress={() => setShowWhy((v) => !v)}>
                    <Text style={styles.newsRefresh}>
                      {showWhy ? "Hide" : "Show me why"} ({chart.showMeWhy.length})
                    </Text>
                  </Pressable>
                  {showWhy &&
                    chart.showMeWhy.map((w, i) => (
                      <Text key={i} style={styles.newsRationale}>
                        {w.role === "SUPPORTING" ? "✓ " : "⚠ "}
                        {w.sourceType}
                        {w.note ? ` — ${w.note}` : ""}
                      </Text>
                    ))}
                </View>
              )}
            </View>
          )}

          {scorecard &&
            (scorecard.financialStrength != null ||
              scorecard.pe != null ||
              scorecard.roe != null) && (
              <View style={{ gap: 4 }}>
                <Text style={styles.fieldTitle}>Financial strength</Text>
                <View style={styles.newsItem}>
                  <Text
                    style={[styles.scStrength, { color: strengthColor(scorecard.financialStrength) }]}
                  >
                    {scorecard.financialStrength ?? "—"}
                    {scorecard.financialStrength != null && (
                      <Text style={styles.scStrengthSuffix}>
                        {" "}
                        /100 · {strengthLabel(scorecard.financialStrength)}
                      </Text>
                    )}
                  </Text>
                  <View style={styles.scGrid}>
                    <ScStat label="P/E" value={scorecard.pe != null ? scorecard.pe.toFixed(1) : "—"} />
                    <ScStat label="ROE" value={pct(scorecard.roe)} />
                    <ScStat label="Net margin" value={pct(scorecard.netMargin)} />
                    <ScStat
                      label="Debt/Eq"
                      value={scorecard.debtToEquity != null ? scorecard.debtToEquity.toFixed(2) : "—"}
                    />
                  </View>
                  <Text style={styles.hint}>
                    Heuristic from public fundamentals — educational, not advice.
                  </Text>
                </View>
              </View>
            )}

          {filings && (
            <View style={{ gap: 4 }}>
              <Text style={styles.fieldTitle}>SEC filings</Text>
              <View style={styles.newsItem}>
                {filings.filings.length === 0 ? (
                  <Text style={styles.hint}>No recent 10-K / 10-Q filings.</Text>
                ) : (
                  filings.filings.slice(0, 6).map((f, i) => (
                    <Pressable
                      key={i}
                      onPress={() => Linking.openURL(f.url)}
                      style={styles.filingRow}
                    >
                      <Text style={styles.filingForm}>{f.form}</Text>
                      <Text style={styles.hint}>{fmtDate(f.filingDate)}</Text>
                    </Pressable>
                  ))
                )}
                <Pressable onPress={() => Linking.openURL(filings.edgarUrl)}>
                  <Text style={styles.newsRefresh}>View all on SEC EDGAR →</Text>
                </Pressable>
              </View>
            </View>
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
  back: { color: colors.blue, fontWeight: "600" },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink },
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
  verdictBox: { backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 10, gap: 3 },
  verdictTitle: { fontSize: 12, fontWeight: "700", color: "#374151" },
  verdictReason: { fontSize: 13, color: "#4b5563", lineHeight: 18 },
  moversTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  moversHint: { fontSize: 12, color: "#6b7280" },
  moverRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  moverTicker: { fontWeight: "600", color: "#2563eb", flex: 1 },
  moverPrice: { color: "#374151", width: 90, textAlign: "right" },
  moverPct: { fontSize: 12, fontWeight: "600", width: 80, textAlign: "right" },
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
  levelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 },
  levelLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  levelLine: { width: 16, height: 3, borderRadius: 2 },
  levelLabel: { fontSize: 12, color: "#374151" },
  levelPrice: { fontSize: 12, fontWeight: "700" },
  chartEvents: { gap: 2, marginTop: 6, borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 6 },
  eventRow: { fontSize: 12 },
  eventDate: { color: "#9ca3af" },
  learnBox: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe", borderWidth: 1, borderRadius: 10, padding: 12, gap: 4 },
  learnTitle: { fontWeight: "700", color: "#1e40af", fontSize: 14 },
  learnIntro: { fontSize: 11, color: "#3b5b8c" },
  learnItem: { borderTopWidth: 1, borderTopColor: "#dbeafe", paddingTop: 6, gap: 3 },
  learnItemTitle: { fontSize: 13, fontWeight: "600", color: "#1d4ed8" },
  learnBody: { fontSize: 13, color: "#374151", lineHeight: 19 },
  scStrength: { fontSize: 30, fontWeight: "800" },
  scStrengthSuffix: { fontSize: 13, fontWeight: "400", color: colors.slate400 },
  scGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 },
  scStat: { minWidth: 64 },
  scStatLabel: { fontSize: 11, color: colors.slate400 },
  scStatValue: { fontSize: 14, fontWeight: "700", color: colors.slate700 },
  filingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#eee" },
  filingForm: { fontSize: 13, fontWeight: "700", color: colors.blue },
});
