import { useEffect, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { apiFetch } from "../lib/api";

/**
 * Inline glossary tooltips for mobile — the parity twin of the web <Term>.
 * <GlossaryProvider> (mounted once in the root layout) loads the term library a
 * single time and owns one shared definition modal; <Term> turns any jargon into
 * tap-to-define text. Non-advisory: it explains what a term means, never what to
 * do. Graceful — until the library loads, or for any unknown term, <Term>
 * renders its text plainly with no decoration or tap target.
 *
 * Implementation note: this uses a tiny module-level store rather than React
 * Context on purpose. The mobile workspace runs React 19 while the hoisted
 * react-native binds @types/react 18; a `createContext().Provider` straddles the
 * two ReactNode definitions and fails typecheck. An external store avoids any
 * `.Provider` JSX while still letting one shared modal serve every <Term>.
 */

interface GlossaryTerm {
  term: string;
  keys: string[];
  short: string;
  full?: string;
}

function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ── Module-level store (single GlossaryProvider mounts at the app root) ───────
let glossaryMap: Map<string, GlossaryTerm> | null = null;
let activeTerm: GlossaryTerm | null = null;
const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}
function openTerm(entry: GlossaryTerm) {
  activeTerm = entry;
  notify();
}
function closeTerm() {
  activeTerm = null;
  notify();
}

/** Subscribe a component to store changes; returns the current snapshot. */
function useGlossaryStore() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { map: glossaryMap, active: activeTerm };
}

export function GlossaryProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const { active } = useGlossaryStore();

  useEffect(() => {
    if (!isSignedIn || glossaryMap) return;
    let alive = true;
    (async () => {
      try {
        const token = await getToken();
        const terms = await apiFetch<GlossaryTerm[]>("/api/v1/glossary", token);
        if (!alive) return;
        const m = new Map<string, GlossaryTerm>();
        for (const entry of terms) {
          for (const key of [entry.term, ...entry.keys]) {
            const norm = normalizeKey(key);
            if (norm && !m.has(norm)) m.set(norm, entry);
          }
        }
        glossaryMap = m;
        notify();
      } catch {
        // Glossary is an enhancement — never block the screen if it fails.
      }
    })();
    return () => {
      alive = false;
    };
  }, [isSignedIn, getToken]);

  return (
    <>
      {children}
      <Modal visible={active != null} transparent animationType="fade" onRequestClose={closeTerm}>
        <Pressable style={styles.backdrop} onPress={closeTerm}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.cardTerm}>{active?.term}</Text>
            <ScrollView style={styles.cardScroll}>
              <Text style={styles.cardShort}>{active?.short}</Text>
              {active?.full ? <Text style={styles.cardFull}>{active.full}</Text> : null}
            </ScrollView>
            <Text style={styles.cardNote}>Educational definition — not advice.</Text>
            <Pressable style={styles.closeBtn} onPress={closeTerm}>
              <Text style={styles.closeText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/**
 * <Term k="REBUY_WATCH">Rebuy Watch</Term> — explicit key, or
 * <Term>Stop loss</Term>                    — key derived from the visible text.
 * `children` must be a string and is rendered inside a parent <Text>.
 */
export function Term({ k, children }: { k?: string; children: string }) {
  const { map } = useGlossaryStore();
  const entry = map ? map.get(normalizeKey(k ?? children)) : undefined;
  if (!entry) return <Text>{children}</Text>;
  return (
    <Text
      style={styles.term}
      onPress={() => openTerm(entry)}
      accessibilityRole="button"
      accessibilityLabel={`${entry.term}: ${entry.short}`}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  term: {
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
    textDecorationColor: "#9ca3af",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
  },
  cardTerm: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 8 },
  cardScroll: { maxHeight: 260 },
  cardShort: { fontSize: 14, lineHeight: 20, color: "#374151" },
  cardFull: { fontSize: 13, lineHeight: 19, color: "#6b7280", marginTop: 8 },
  cardNote: { fontSize: 11, color: "#9ca3af", marginTop: 12 },
  closeBtn: {
    marginTop: 14,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  closeText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
