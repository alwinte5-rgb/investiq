import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import "./globals.css";

// Single ClerkProvider at the root so the header can reflect auth state. The
// publishable key is supplied at build time (see apps/web/Dockerfile), so the
// statically-prerendered marketing/error pages render the provider safely; the
// <SignedIn>/<SignedOut> control components resolve on the client.

export const metadata: Metadata = {
  title: "InvestIQ Forex — Know your risk before you place the trade",
  description:
    "Forex education, position sizing, and trade planning. Turn pips, lots, margin, and leverage into clear dollar amounts. Educational only — not trading advice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // TEMPORARY guest mode: skip Clerk entirely (provider + auth-aware header).
  // ClerkJS on a dev instance decorates/redirects navigation, which blocks
  // crawlers and agents. Unset GUEST_MODE and rebuild to restore login.
  const guestMode = process.env.GUEST_MODE === "true";

  const page = (
    <html lang="en">
        <body>
          <header className="flex items-center justify-between border-b px-6 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              Invest<span className="text-blue-600">IQ</span>{" "}
              <span className="text-slate-400 font-normal">Forex</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/pricing" className="hover:underline">
                Pricing
              </Link>
              {guestMode ? (
                <>
                  <Link href="/dashboard" className="hover:underline">
                    Open app
                  </Link>
                  <span className="rounded-full border px-2 py-0.5 text-xs text-slate-500">
                    Guest preview — no login required
                  </span>
                </>
              ) : (
                <>
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
                </>
              )}
            </nav>
          </header>
          <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
          <footer className="mx-auto max-w-5xl space-y-1 px-6 py-8 text-xs text-neutral-500">
            <p>
              InvestIQ Forex provides educational tools and estimated calculations. It does not
              provide personalized financial advice, trade signals, or brokerage services.
            </p>
            <p>
              Forex trading involves substantial risk. Leverage can magnify both gains and losses.{" "}
              <Link href="/disclosures" className="underline">
                Full disclosures
              </Link>
            </p>
          </footer>
        </body>
    </html>
  );

  return guestMode ? page : <ClerkProvider>{page}</ClerkProvider>;
}
