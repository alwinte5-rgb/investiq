import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SignedIn, SignedOut, useAuth } from "@clerk/clerk-expo";
import { apiFetch } from "../lib/api";

interface WatchlistItem {
  id: string;
  symbol: { ticker: string; name: string; assetType: "STOCK" | "ETF" };
}
interface Watchlist {
  id: string;
  name: string;
  items: WatchlistItem[];
}

function Manager() {
  const { getToken } = useAuth();
  const [lists, setLists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const token = await getToken();
      setLists(await apiFetch<Watchlist[]>("/api/v1/watchlists", token));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const token = await getToken();
      await apiFetch("/api/v1/watchlists", token, {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  return (
    <View style={{ flex: 1, gap: 12 }}>
      <View style={styles.row}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="New watchlist name"
          style={styles.input}
        />
        <Pressable
          onPress={create}
          disabled={busy || !name.trim()}
          style={[styles.btn, (busy || !name.trim()) && styles.btnDisabled]}
        >
          <Text style={styles.btnText}>{busy ? "…" : "Create"}</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {lists.length === 0 ? (
        <Text style={styles.hint}>No watchlists yet. Create one above.</Text>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(w) => w.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              {item.items.length === 0 ? (
                <Text style={styles.hint}>No symbols yet.</Text>
              ) : (
                item.items.map((it) => (
                  <Text key={it.id} style={styles.symRow}>
                    {it.symbol.ticker} · {it.symbol.name}
                  </Text>
                ))
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

export default function WatchlistsScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.h1}>Watchlists</Text>
      <SignedIn>
        <Manager />
      </SignedIn>
      <SignedOut>
        <Text style={styles.hint}>Sign in to manage your watchlists.</Text>
      </SignedOut>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 12 },
  h1: { fontSize: 22, fontWeight: "600" },
  row: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  btn: { backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 14, justifyContent: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "white", fontWeight: "600" },
  card: { borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 10, padding: 14, marginBottom: 10, gap: 4 },
  cardTitle: { fontWeight: "600", fontSize: 15 },
  symRow: { fontSize: 13, color: "#444" },
  hint: { fontSize: 13, color: "#888" },
  error: { color: "#b91c1c", fontSize: 13 },
});
