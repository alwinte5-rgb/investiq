import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { authStyles as s } from "../lib/auth-styles";
import { clerkError } from "../lib/clerk-error";

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onCreate() {
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (e) {
      setError(clerkError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/");
      } else {
        setError("Verification incomplete. Check the code and try again.");
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

          {!pendingVerification ? (
            <>
              <Text style={s.title}>Create account</Text>
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
                onPress={onCreate}
                disabled={busy || !email.trim() || !password}
                style={[s.btn, (busy || !email.trim() || !password) && s.btnDisabled]}
              >
                <Text style={s.btnText}>{busy ? "Creating…" : "Continue"}</Text>
              </Pressable>
              <View style={s.row}>
                <Text style={s.muted}>Have an account? </Text>
                <Link href="/sign-in" style={s.link}>
                  Sign in
                </Link>
              </View>
            </>
          ) : (
            <>
              <Text style={s.title}>Verify your email</Text>
              <Text style={s.hint}>We sent a 6-digit code to {email.trim()}.</Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="Verification code"
                keyboardType="number-pad"
                style={s.input}
              />
              {error && <Text style={s.error}>{error}</Text>}
              <Pressable
                onPress={onVerify}
                disabled={busy || !code.trim()}
                style={[s.btn, (busy || !code.trim()) && s.btnDisabled]}
              >
                <Text style={s.btnText}>{busy ? "Verifying…" : "Verify"}</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
