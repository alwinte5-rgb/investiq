import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { colors } from "../lib/theme";

const SUGGESTED = [
  "Is my portfolio too risky?",
  "What does my portfolio health score mean?",
  "How should I think about diversification?",
  "What should I look at before researching a stock?",
  "How much should I invest each month?",
  "Explain the P/E ratio with an example.",
];

interface Msg {
  role: "user" | "advisor";
  text: string;
}

function Advisor() {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function ask(q: string) {
    const question = q.trim();
    if (question.length < 3 || pending) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setPending(true);
    // Defer to next frame so the just-added user message is laid out first.
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    try {
      const token = await getToken();
      const { answer } = await apiFetch<{ answer: string }>("/api/v1/advisor", token, {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      setMessages((m) => [...m, { role: "advisor", text: answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Advisor unavailable");
    } finally {
      setPending(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && (
          <View style={styles.introCard}>
            <Text style={styles.introText}>
              Ask about an investing concept or your own portfolio. Try one of these:
            </Text>
            <View style={styles.chips}>
              {SUGGESTED.map((s) => (
                <Pressable key={s} onPress={() => ask(s)} style={styles.chip}>
                  <Text style={styles.chipText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {messages.map((m, i) => (
          <View key={i} style={m.role === "user" ? styles.userWrap : styles.advisorWrap}>
            <View style={m.role === "user" ? styles.userBubble : styles.advisorBubble}>
              <Text style={m.role === "user" ? styles.userText : styles.advisorTextBody}>
                {m.text}
              </Text>
            </View>
          </View>
        ))}
        {pending && (
          <View style={styles.advisorWrap}>
            <View style={styles.advisorBubble}>
              <Text style={styles.thinking}>Thinking…</Text>
            </View>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about investing or your portfolio…"
          style={styles.input}
          editable={!pending}
          onSubmitEditing={() => ask(input)}
          returnKeyType="send"
        />
        <Pressable
          onPress={() => ask(input)}
          disabled={pending || input.trim().length < 3}
          style={[styles.sendBtn, (pending || input.trim().length < 3) && styles.btnDisabled]}
        >
          {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>Ask</Text>}
        </Pressable>
      </View>

      <Text style={styles.disclaimer}>
        Educational only — InvestIQ is not a financial advisor and never gives buy/sell or
        personalized investment advice.
      </Text>
    </KeyboardAvoidingView>
  );
}

export default function AdvisorScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Link href="/" style={styles.back}>
        ← Home
      </Link>
      <Text style={styles.h1}>AI Advisor</Text>
      <SignedIn>
        <Advisor />
      </SignedIn>
      <SignedOut>
        <Text style={styles.hint}>Sign in to ask the AI Advisor.</Text>
      </SignedOut>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 12 },
  back: { color: colors.blue, fontWeight: "600" },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink },
  hint: { fontSize: 13, color: colors.slate500 },
  introCard: { borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 14, padding: 16, gap: 12 },
  introText: { fontSize: 14, color: colors.slate600, lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.slate300, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 12, color: colors.slate700 },
  userWrap: { alignItems: "flex-end" },
  advisorWrap: { alignItems: "flex-start" },
  userBubble: { maxWidth: "85%", backgroundColor: colors.blue, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  advisorBubble: { maxWidth: "85%", borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  userText: { color: "#fff", fontSize: 14, lineHeight: 20 },
  advisorTextBody: { color: colors.slate700, fontSize: 14, lineHeight: 20 },
  thinking: { color: colors.slate400, fontSize: 14 },
  error: { color: colors.red700, fontSize: 13 },
  composer: { flexDirection: "row", gap: 8, paddingTop: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: colors.slate300, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: colors.white },
  sendBtn: { backgroundColor: colors.blue, borderRadius: 10, paddingHorizontal: 18, justifyContent: "center", minWidth: 64, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  sendText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  disclaimer: { fontSize: 11, color: colors.slate400, marginTop: 6 },
});
