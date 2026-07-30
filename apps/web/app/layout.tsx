import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

// Single ClerkProvider at the root so the header can reflect auth state. The
// publishable key is supplied at build time (see apps/web/Dockerfile). This is
// a PERSONAL trading dashboard — sign-ups are closed; Clerk is the door lock.

export const metadata: Metadata = {
  title: "InvestIQ — Trading Command",
  description:
    "Personal trading command center: quant bots, options, futures, forex — research, paper trading, and risk in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // TEMPORARY guest mode: skip Clerk entirely (provider + auth-aware header).
  // Unset GUEST_MODE and rebuild to restore login.
  const guestMode = process.env.GUEST_MODE === "true";

  const page = (
    <html lang="en">
        <head>
          {/* Set the theme on <html> BEFORE first paint to avoid a flash of
              the wrong theme. Defaults to dark (owner preference); honors a
              saved choice from the toggle. */}
          <script
            dangerouslySetInnerHTML={{
              __html:
                "(function(){try{var t=localStorage.getItem('theme');if(t!=='light'){document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();",
            }}
          />
        </head>
        <body className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 px-6 py-3 dark:border-neutral-800">
            <Link href="/" className="font-semibold tracking-tight">
              Invest<span className="text-cyan-500">IQ</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <ThemeToggle />
              {guestMode ? (
                <Link href="/dashboard" className="hover:underline">
                  Open app
                </Link>
              ) : (
                <>
                  <SignedIn>
                    <Link href="/dashboard" className="hover:underline">
                      Dashboard
                    </Link>
                    <UserButton afterSignOutUrl="/" />
                  </SignedIn>
                  <SignedOut>
                    <Link
                      href="/sign-in"
                      className="rounded-md bg-cyan-600 px-3 py-1.5 font-medium text-white hover:bg-cyan-500"
                    >
                      Sign in
                    </Link>
                  </SignedOut>
                </>
              )}
            </nav>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-slate-200 px-6 py-4 text-xs text-neutral-500 dark:border-neutral-800">
            <p>
              Personal research & paper-trading dashboard. Educational only — nothing here is
              financial advice.{" "}
              <Link href="/disclosures" className="underline">
                Disclosures
              </Link>
            </p>
          </footer>
        </body>
    </html>
  );

  return guestMode ? page : <ClerkProvider>{page}</ClerkProvider>;
}
