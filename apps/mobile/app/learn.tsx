import { useEffect, useState } from "react";
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

interface LearningContent {
  slug: string;
  title: string;
  body: string;
  tags: string[];
}
interface LearningSection {
  title: string;
  intro: string;
  items: LearningContent[];
}

function LearnHub() {
  const { getToken } = useAuth();
  const [sections, setSections] = useState<LearningSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getToken();
        const s = await apiFetch<LearningSection[]>("/api/v1/learning", token);
        if (active) setSections(s);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load lessons");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [getToken]);

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;
  if (error) return <Text style={styles.error}>{error}</Text>;

  return (
    <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 32 }}>
      <Text style={styles.sub}>
        Plain-English investing basics — educational, not advice. Tap a topic to expand.
      </Text>
      {sections.map((s) => (
        <View key={s.title} style={{ gap: 6 }}>
          <Text style={styles.sectionTitle}>{s.title}</Text>
          <Text style={styles.sectionIntro}>{s.intro}</Text>
          <View style={styles.card}>
            {s.items.map((it) => (
              <View key={it.slug} style={styles.item}>
                <Pressable onPress={() => setOpen((o) => (o === it.slug ? null : it.slug))}>
                  <Text style={styles.itemTitle}>
                    {open === it.slug ? "– " : "+ "}
                    {it.title}
                  </Text>
                </Pressable>
                {open === it.slug && <Text style={styles.itemBody}>{it.body}</Text>}
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

export default function LearnScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topRow}>
        <Link href="/" style={styles.back}>
          ← Home
        </Link>
        <Link href="/research" style={styles.back}>
          Research →
        </Link>
      </View>
      <Text style={styles.h1}>Learn</Text>
      <SignedIn>
        <LearnHub />
      </SignedIn>
      <SignedOut>
        <Text style={styles.sub}>Sign in to access the lessons.</Text>
      </SignedOut>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 12 },
  topRow: { flexDirection: "row", justifyContent: "space-between" },
  back: { color: "#2563eb", fontWeight: "600" },
  h1: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  sub: { fontSize: 13, color: "#6b7280" },
  error: { color: "#b91c1c", fontSize: 14, marginTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  sectionIntro: { fontSize: 13, color: "#6b7280" },
  card: { borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 10, overflow: "hidden" },
  item: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e5e7eb" },
  itemTitle: { fontSize: 14, fontWeight: "600", color: "#1f2937" },
  itemBody: { fontSize: 14, color: "#374151", lineHeight: 20, marginTop: 6 },
});
