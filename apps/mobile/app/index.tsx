import { useEffect, useState } from "react";
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

export default function Index() {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.brand}>
        Invest<Text style={styles.brandAccent}>IQ</Text>
      </Text>
      <SignedIn>
        <Dashboard />
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
  nav: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16 },
  navLink: { color: "#2563eb", fontWeight: "600" },
  linkMuted: { color: "#666", textAlign: "center" },
  disclaimer: { fontSize: 11, color: "#999", textAlign: "center" },
});
