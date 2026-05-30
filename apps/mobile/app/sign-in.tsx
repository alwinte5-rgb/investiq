import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { authStyles as s } from "../lib/auth-styles";
import { clerkError } from "../lib/clerk-error";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSignIn() {
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      const attempt = await signIn.create({ identifier: email.trim(), password });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/");
      } else {
        // e.g. needs additional factor — out of scope for this MVP.
        setError("Additional verification required.");
      }
    } catch (e) {
      setError(clerkError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
        <View style={s.body}>
          <Text style={s.brand}>
            Invest<Text style={s.accent}>IQ</Text>
          </Text>
          <Text style={s.title}>Sign in</Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            style={s.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            style={s.input}
          />

          {error && <Text style={s.error}>{error}</Text>}

          <Pressable
            onPress={onSignIn}
            disabled={busy || !email.trim() || !password}
            style={[s.btn, (busy || !email.trim() || !password) && s.btnDisabled]}
          >
            <Text style={s.btnText}>{busy ? "Signing in…" : "Sign in"}</Text>
          </Pressable>

          <View style={s.row}>
            <Text style={s.muted}>New here? </Text>
            <Link href="/sign-up" style={s.link}>
              Create an account
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
