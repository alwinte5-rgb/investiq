import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SignedIn, SignedOut, useAuth } from "@clerk/clerk-expo";
import { Link } from "expo-router";
import { apiFetch } from "../lib/api";

interface Prefs {
  timezone: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  morningBriefing: boolean;
  weeklyReview: boolean;
  monthlyReview: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
];

const hourLabel = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:00`;
const wrapHour = (h: number) => ((h % 24) + 24) % 24;

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

function Stepper({ label, minutes, onChange }: { label: string; minutes: number; onChange: (m: number) => void }) {
  const hour = Math.floor(minutes / 60);
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable onPress={() => onChange(wrapHour(hour - 1) * 60)} style={styles.stepBtn}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{hourLabel(minutes)}</Text>
        <Pressable onPress={() => onChange(wrapHour(hour + 1) * 60)} style={styles.stepBtn}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Settings() {
  const { getToken } = useAuth();
  const [p, setP] = useState<Prefs | null>(null);
  const [quietOn, setQuietOn] = useState(false);
  const [qStart, setQStart] = useState(22 * 60);
  const [qEnd, setQEnd] = useState(7 * 60);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const prefs = await apiFetch<Prefs>("/api/v1/me/notification-preferences", token);
      setP(prefs);
      if (prefs.quietHoursStart != null) {
        setQuietOn(true);
        setQStart(prefs.quietHoursStart);
        setQEnd(prefs.quietHoursEnd ?? 7 * 60);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (patch: Partial<Prefs>) => {
    setP((prev) => (prev ? { ...prev, ...patch } : prev));
    setSaved(false);
  };

  async function save() {
    if (!p || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const token = await getToken();
      const patch = {
        timezone: p.timezone,
        emailEnabled: p.emailEnabled,
        pushEnabled: p.pushEnabled,
        morningBriefing: p.morningBriefing,
        weeklyReview: p.weeklyReview,
        monthlyReview: p.monthlyReview,
        quietHoursStart: quietOn ? qStart : null,
        quietHoursEnd: quietOn ? qEnd : null,
      };
      const updated = await apiFetch<Prefs>("/api/v1/me/notification-preferences", token, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setP(updated);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;
  if (!p) return <Text style={styles.error}>{error ?? "No preferences"}</Text>;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 16, paddingBottom: 32 }}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Timezone</Text>
        <View style={styles.chips}>
          {(TIMEZONES.includes(p.timezone) ? TIMEZONES : [p.timezone, ...TIMEZONES]).map((tz) => (
            <Pressable
              key={tz}
              onPress={() => set({ timezone: tz })}
              style={[styles.chip, p.timezone === tz && styles.chipActive]}
            >
              <Text style={[styles.chipText, p.timezone === tz && styles.chipTextActive]}>{tz}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Channels</Text>
        <Row label="Email" value={p.emailEnabled} onChange={(v) => set({ emailEnabled: v })} />
        <Row label="Push" value={p.pushEnabled} onChange={(v) => set({ pushEnabled: v })} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reviews</Text>
        <Row label="Morning briefing" value={p.morningBriefing} onChange={(v) => set({ morningBriefing: v })} />
        <Row label="Weekly review" value={p.weeklyReview} onChange={(v) => set({ weeklyReview: v })} />
        <Row label="Monthly review" value={p.monthlyReview} onChange={(v) => set({ monthlyReview: v })} />
      </View>

      <View style={styles.card}>
        <Row
          label="Quiet hours (mute email & push)"
          value={quietOn}
          onChange={(v) => {
            setQuietOn(v);
            setSaved(false);
          }}
        />
        {quietOn && (
          <>
            <Stepper label="From" minutes={qStart} onChange={(m) => { setQStart(m); setSaved(false); }} />
            <Stepper label="To" minutes={qEnd} onChange={(m) => { setQEnd(m); setSaved(false); }} />
          </>
        )}
        <Text style={styles.hint}>In-app notifications are always recorded.</Text>
      </View>

      <Pressable onPress={save} disabled={busy} style={[styles.btn, busy && styles.btnDisabled]}>
        <Text style={styles.btnText}>{busy ? "Saving…" : "Save preferences"}</Text>
      </Pressable>
      {saved && <Text style={styles.saved}>Saved.</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Link href="/" style={styles.back}>
        ← Home
      </Link>
      <Text style={styles.h1}>Settings</Text>
      <SignedIn>
        <Settings />
      </SignedIn>
      <SignedOut>
        <Text style={styles.hint}>Sign in to manage notifications.</Text>
      </SignedOut>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 12 },
  back: { color: "#2563eb", fontWeight: "600" },
  h1: { fontSize: 22, fontWeight: "600" },
  card: { borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 10, padding: 14, gap: 6 },
  cardTitle: { fontWeight: "600", fontSize: 14, marginBottom: 2 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  toggleLabel: { fontSize: 14, color: "#374151", flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontSize: 12, color: "#555" },
  chipTextActive: { color: "white", fontWeight: "600" },
  stepper: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  stepperLabel: { fontSize: 14, color: "#374151" },
  stepperControls: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: "#d4d4d4", alignItems: "center", justifyContent: "center" },
  stepBtnText: { fontSize: 18, color: "#374151" },
  stepperValue: { fontSize: 14, fontWeight: "600", minWidth: 48, textAlign: "center" },
  btn: { backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "white", fontWeight: "600" },
  saved: { color: "#15803d", fontSize: 13 },
  hint: { fontSize: 12, color: "#888" },
  error: { color: "#b91c1c", fontSize: 13 },
});
