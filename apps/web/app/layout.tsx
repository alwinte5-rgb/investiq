import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import "./globals.css";

// Single ClerkProvider at the root so the header can reflect auth state. The
// publishable key is supplied at build time (see apps/web/Dockerfile), so the
// statically-prerendered marketing/error pages render the provider safely; the
// <SignedIn>/<SignedOut> control components resolve on the client.

export const metadata: Metadata = {
  title: "InvestIQ — AI investment research & education",
  description:
    "AI-powered research, portfolio intelligence, and education for US stocks and ETFs. Educational only — not investment advice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <header className="flex items-center justify-between border-b px-6 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              Invest<span className="text-blue-600">IQ</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/pricing" className="hover:underline">
                Pricing
              </Link>
              {/* Auth-aware: signed-in users get Dashboard + their account menu;
                  signed-out users get Sign in / Sign up. */}
              <SignedIn>
                <Link href="/dashboard" className="hover:underline">
                  Home
                </Link>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
              <SignedOut>
                <Link href="/sign-in" className="hover:underline">
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
                >
                  Sign up
                </Link>
              </SignedOut>
            </nav>
          </header>
          <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
          <footer className="mx-auto max-w-5xl px-6 py-8 text-xs text-neutral-500">
            InvestIQ is an educational research tool, not a financial advisor, broker-dealer, or
            RIA. Nothing here is personalized investment advice. Investing involves risk of loss.
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
