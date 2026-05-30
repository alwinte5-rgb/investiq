import type { Metadata } from "next";
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";

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
              <Link href="/dashboard" className="hover:underline">
                Dashboard
              </Link>
              <SignedOut>
                <SignInButton mode="modal" />
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
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
