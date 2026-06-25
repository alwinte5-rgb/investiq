import { useCallback, useEffect, useState } from "react";
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
import { Link } from "expo-router";
import { apiFetch } from "../lib/api";

interface PaperPosition {
  ticker: string;
  qty: number;
  avgPrice: number;
  price: number | null;
  marketValue: number;
  unrealizedPl: number;
}
interface PaperAccount {
  cash: number;
  equity: number;
  startingCash: number;
  totalPl: number;
  totalPlPct: number;
  positions: PaperPosition[];
}
interface PaperOrder {
  id: string;
  ticker: string;
  side: "BUY" | "SELL";
  qty: number;
  type: string;
  status: string;
  filledPrice: number | null;
  submittedAt: string;
  filledAt: string | null;
}
interface SubmitOrderResult {
  status: "filled" | "rejected";
  orderId: string;
  ticker: string;
  side: "BUY" | "SELL";
  qty: number;
  filledPrice: number | null;
  reason?: string;
  duplicate?: boolean;
}

interface Quote {
  ticker: string;
  price: number;
  change: number | null;
  changePct: number | null;
}

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const plColor = (n: number) => (n > 0 ? "#15803d" : n < 0 ? "#b91c1c" : "#6b7280");

function newKey() {
  // Per-intent idempotency token; the server dedupes retries of the same key.
  return `${Date.now()}${Math.floor(Math.random() * 1e9)}`;
}

function Paper() {
  const { getToken } = useAuth();
  const [account, setAccount] = useState<PaperAccount | null>(null);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [ticker, setTicker] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [a, o] = await Promise.all([
        apiFetch<PaperAccount>("/api/v1/paper/account", token),
        apiFetch<PaperOrder[]>("/api/v1/paper/orders", token),
      ]);
      setAccount(a);
      setOrders(o);
    } catch {
      /* surfaced via order notices; the summary just stays blank on load failure */
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // Debounced live quote for the entered ticker so the ticket shows the fill price.
  useEffect(() => {
    const t = ticker.trim().toUpperCase();
    if (!t) {
      setQuote(null);
      return;
    }
    let active = true;
    const id = setTimeout(async () => {
      try {
        const token = await getToken();
        const q = await apiFetch<Quote>(`/api/v1/symbols/${encodeURIComponent(t)}/quote`, token);
        if (active) setQuote(q);
      } catch {
        if (active) setQuote(null);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [ticker, getToken]);

  async function submit() {
    if (busy) return;
    const t = ticker.trim().toUpperCase();
    const q = Number(qty);
    if (!t) return setNotice({ tone: "err", text: "Enter a ticker symbol." });
    if (!(q > 0)) return setNotice({ tone: "err", text: "Enter a quantity greater than zero." });

    setBusy(true);
    setNotice(null);
    try {
      const token = await getToken();
      const r = await apiFetch<SubmitOrderResult>("/api/v1/paper/orders", token, {
        method: "POST",
        body: JSON.stringify({ ticker: t, side, qty: q, type: "market", idempotencyKey: newKey() }),
      });
      if (r.status === "rejected") {
        setNotice({ tone: "warn", text: r.reason ?? "Order rejected." });
      } else if (r.duplicate) {
        setNotice({ tone: "warn", text: "Duplicate ignored — this order was already placed." });
      } else {
        setNotice({
          tone: "ok",
          text: `${r.side} ${r.qty} ${r.ticker} filled at ${r.filledPrice != null ? usd(r.filledPrice) : "—"}.`,
        });
        setQty("");
      }
      await load();
    } catch (e) {
      setNotice({ tone: "err", text: e instanceof Error ? e.message : "Failed to submit order" });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  const positions = account?.positions ?? [];
  const noticeColor =
    notice?.tone === "ok" ? "#15803d" : notice?.tone === "warn" ? "#b45309" : "#b91c1c";

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: 28 }}>
      {/* Account summary */}
      <View style={styles.statRow}>
        <Stat label="Equity" value={account ? usd(account.equity) : "—"} />
        <Stat label="Cash" value={account ? usd(account.cash) : "—"} />
      </View>
      <View style={styles.statRow}>
        <Stat
          label="Total P&L"
          value={account ? usd(account.totalPl) : "—"}
          color={account ? plColor(account.totalPl) : undefined}
        />
        <Stat
          label="Return"
          value={account ? `${account.totalPlPct >= 0 ? "+" : ""}${account.totalPlPct}%` : "—"}
          color={account ? plColor(account.totalPlPct) : undefined}
        />
      </View>

      {/* Order ticket */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Place a simulated order</Text>
        <View style={styles.formRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.fieldLabel}>Ticker</Text>
            <TextInput
              value={ticker}
              onChangeText={(v) => setTicker(v.toUpperCase())}
              placeholder="AAPL"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={10}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.fieldLabel}>Quantity</Text>
            <TextInput
              value={qty}
              onChangeText={(v) => setQty(v.replace(/[^0-9.]/g, ""))}
              placeholder="10"
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
        </View>
        <View style={styles.sideRow}>
          {(["BUY", "SELL"] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setSide(s)}
              style={[
                styles.sideBtn,
                side === s && (s === "BUY" ? styles.sideBuyActive : styles.sideSellActive),
              ]}
            >
              <Text style={[styles.sideText, side === s && styles.sideTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </View>
        {quote && (
          <Text style={styles.quoteLine}>
            Current price <Text style={styles.quotePrice}>{usd(quote.price)}</Text>
            {quote.changePct != null ? (
              <Text style={{ color: plColor(quote.changePct) }}>
                {"  "}
                {quote.changePct >= 0 ? "+" : ""}
                {quote.changePct.toFixed(2)}%
              </Text>
            ) : null}
            {Number(qty) > 0 ? (
              <Text style={styles.muted}>
                {"  ·  Est. "}
                {side === "BUY" ? "cost " : "proceeds "}
                {usd(quote.price * Number(qty))}
              </Text>
            ) : null}
          </Text>
        )}
        <Pressable onPress={submit} disabled={busy} style={[styles.submitBtn, busy && styles.btnDisabled]}>
          <Text style={styles.submitText}>{busy ? "Submitting…" : "Submit market order"}</Text>
        </Pressable>
        {notice && <Text style={[styles.notice, { color: noticeColor }]}>{notice.text}</Text>}
        <Text style={styles.fine}>
          Market orders fill at the current quote. Simulated only — no real money or brokerage.
        </Text>
      </View>

      {/* Positions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Positions</Text>
        {positions.length === 0 ? (
          <Text style={styles.muted}>No open positions yet. Place a buy order to get started.</Text>
        ) : (
          positions.map((p) => (
            <View key={p.ticker} style={styles.posRow}>
              <View>
                <Text style={styles.posTicker}>{p.ticker}</Text>
                <Text style={styles.muted}>
                  {p.qty} @ {usd(p.avgPrice)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.posValue}>{usd(p.marketValue)}</Text>
                <Text style={[styles.posPl, { color: plColor(p.unrealizedPl) }]}>
                  {p.unrealizedPl >= 0 ? "+" : ""}
                  {usd(p.unrealizedPl)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Order history */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Order history</Text>
        {orders.length === 0 ? (
          <Text style={styles.muted}>No orders yet.</Text>
        ) : (
          orders.map((o) => (
            <View key={o.id} style={styles.posRow}>
              <View>
                <Text style={styles.posTicker}>
                  <Text style={{ color: o.side === "BUY" ? "#15803d" : "#b91c1c" }}>{o.side}</Text>{" "}
                  {o.qty} {o.ticker}
                </Text>
                <Text style={styles.muted}>{new Date(o.submittedAt).toLocaleDateString()}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.posValue}>{o.filledPrice != null ? usd(o.filledPrice) : "—"}</Text>
                <Text
                  style={[
                    styles.statusBadge,
                    o.status === "filled"
                      ? styles.statusFilled
                      : o.status === "rejected"
                        ? styles.statusRejected
                        : styles.statusOther,
                  ]}
                >
                  {o.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <Text style={styles.disclaimer}>
        Paper trading is a simulation for learning — no real orders, money or brokerage involved.
      </Text>
    </ScrollView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

export default function PaperScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Link href="/" style={styles.back}>
        ← Home
      </Link>
      <Text style={styles.h1}>Paper Trading</Text>
      <SignedIn>
        <Paper />
      </SignedIn>
      <SignedOut>
        <Text style={styles.hint}>Sign in to use the paper trading simulator.</Text>
      </SignedOut>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 12 },
  back: { color: "#2563eb", fontWeight: "600" },
  h1: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  hint: { fontSize: 13, color: "#888" },
  statRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 10, padding: 12 },
  statLabel: { fontSize: 12, color: "#6b7280" },
  statValue: { fontSize: 17, fontWeight: "700", color: "#111", marginTop: 2 },
  card: { borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 10, padding: 14, gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: "600" },
  formRow: { flexDirection: "row", gap: 10 },
  fieldLabel: { fontSize: 12, color: "#6b7280" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  sideRow: { flexDirection: "row", gap: 8 },
  sideBtn: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  sideBuyActive: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  sideSellActive: { backgroundColor: "#dc2626", borderColor: "#dc2626" },
  sideText: { fontWeight: "700", color: "#374151" },
  sideTextActive: { color: "white" },
  submitBtn: { backgroundColor: "#111827", borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  submitText: { color: "white", fontWeight: "600" },
  notice: { fontSize: 13 },
  fine: { fontSize: 11, color: "#9ca3af" },
  muted: { fontSize: 13, color: "#6b7280" },
  quoteLine: { fontSize: 13, color: "#374151" },
  quotePrice: { fontWeight: "700", color: "#111827" },
  posRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 8 },
  posTicker: { fontSize: 14, fontWeight: "600", color: "#111" },
  posValue: { fontSize: 14, fontWeight: "600", color: "#111" },
  posPl: { fontSize: 12, fontWeight: "600" },
  statusBadge: { fontSize: 11, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999, overflow: "hidden", marginTop: 2 },
  statusFilled: { backgroundColor: "#dcfce7", color: "#15803d" },
  statusRejected: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  statusOther: { backgroundColor: "#f3f4f6", color: "#4b5563" },
  disclaimer: { fontSize: 11, color: "#999", marginTop: 4 },
});
