import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import { Slot } from "expo-router";
import { tokenCache } from "../lib/cache";
import { GlossaryProvider } from "../components/glossary";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <GlossaryProvider>
          <Slot />
        </GlossaryProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
