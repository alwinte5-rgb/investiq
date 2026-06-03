import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { SignedIn, SignedOut, useAuth } from "@clerk/clerk-expo";
import { Link } from "expo-router";
import { apiFetch } from "../lib/api";

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <Pressable onPress={() => signOut()}>
      <Text style={styles.link}>Sign out</Text>
    </Pressable>
  );
}

interface Me {
  userId: string;
  plan: "FREE" | "INVESTOR" | "INVESTOR_PLUS";
  role: "USER" | "ADMIN";
}

function Dashboard() {
  const { getToken } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getToken();
        const data = await apiFetch<Me>("/api/v1/me", token);
        if (active) setMe(data);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [getToken]);

  return (
    <View style={styles.card}>
      <Text style={styles.h1}>Dashboard</Text>
      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={styles.error}>Couldn’t load your account: {error}</Text>
      ) : me ? (
        <>
          <Text style={styles.row}>Plan: {me.plan}</Text>
          <Text style={styles.row}>Role: {me.role}</Text>
        </>
      ) : (
        <Text style={styles.row}>No data</Text>
      )}
    </View>
  );
}

interface Summary {
  positions: number;
  connected: boolean;
}
interface Connection {
  id: string;
  status: string;
}

/** Lets users explore with a seeded sample portfolio before connecting a broker. */
function SampleData() {
  const { getToken } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [s, conns] = await Promise.all([
        apiFetch<Summary>("/api/v1/portfolio/summary", token),
        apiFetch<Connection[]>("/api/v1/connections", token),
      ]);
      setSummary(s);
      setConnection(conns[0] ?? null);
    } catch {
      /* non-critical card — stay silent on load failure */
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadDemo() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      await apiFetch("/api/v1/connections/demo", token, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sample data");
    } finally {
      setBusy(false);
    }
  }

  async function removeDemo() {
    if (busy || !connection) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      await apiFetch(`/api/v1/connections/${connection.id}`, token, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;
  const isDemo = connection?.status === "demo";
  // Real brokerage connected — nothing to offer here.
  if (summary?.connected && !isDemo) return null;

  return (
    <View style={styles.card}>
      {isDemo ? (
        <>
          <Text style={styles.row}>
            Sample data loaded — {summary?.positions ?? 0} positions. Open Portfolio or Reviews to
            explore.
          </Text>
          <Pressable onPress={removeDemo} disabled={busy} style={styles.demoBtn}>
            <Text style={styles.demoBtnText}>{busy ? "Removing…" : "Remove sample data"}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.row}>No brokerage connected yet.</Text>
          <Pressable onPress={loadDemo} disabled={busy} style={styles.demoBtn}>
            <Text style={styles.demoBtnText}>{busy ? "Loading…" : "Try with sample data"}</Text>
          </Pressable>
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export default function Index() {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.brand}>
        Invest<Text style={styles.brandAccent}>IQ</Text>
      </Text>
      <SignedIn>
        <Dashboard />
        <SampleData />
        <View style={styles.nav}>
          <Link href="/research" style={styles.navLink}>
            Research
          </Link>
          <Link href="/portfolio" style={styles.navLink}>
            Portfolio
          </Link>
          <Link href="/reviews" style={styles.navLink}>
            Reviews
          </Link>
          <Link href="/watchlists" style={styles.navLink}>
            Watchlists
          </Link>
          <Link href="/settings" style={styles.navLink}>
            Settings
          </Link>
        </View>
        <SignOutButton />
      </SignedIn>
      <SignedOut>
        <View style={styles.card}>
          <Text style={styles.row}>Sign in to view your research dashboard.</Text>
          <Link href="/sign-in" style={styles.link}>
            Sign in
          </Link>
          <Link href="/sign-up" style={styles.linkMuted}>
            Create an account
          </Link>
        </View>
      </SignedOut>
      <Text style={styles.disclaimer}>
        Educational research only — not investment advice. Investing involves risk of loss.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 16, justifyContent: "center" },
  brand: { fontSize: 28, fontWeight: "700", textAlign: "center" },
  brandAccent: { color: "#2563eb" },
  card: { borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 10, padding: 16, gap: 8 },
  h1: { fontSize: 20, fontWeight: "600" },
  row: { fontSize: 15 },
  hint: { fontSize: 12, color: "#888" },
  error: { color: "#b91c1c", fontSize: 14 },
  link: { color: "#2563eb", fontWeight: "600", textAlign: "center" },
  demoBtn: { borderWidth: 1, borderColor: "#2563eb", borderRadius: 8, paddingVertical: 9, alignItems: "center", marginTop: 4 },
  demoBtnText: { color: "#2563eb", fontWeight: "600" },
  nav: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16 },
  navLink: { color: "#2563eb", fontWeight: "600" },
  linkMuted: { color: "#666", textAlign: "center" },
  disclaimer: { fontSize: 11, color: "#999", textAlign: "center" },
});
