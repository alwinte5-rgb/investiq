import Link from "next/link";
import { GlossaryProvider } from "@/components/term";

// In-app sub-nav for the authed routes. The ClerkProvider + account menu live in
// the root layout header, so this layout only renders navigation.
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlossaryProvider>
      <div className="mb-6 flex items-center justify-between gap-3 border-b pb-3 text-sm">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {/* Co-Pilot nav. Reviews are folded into Home; Watchlists routes to
              Opportunities. Settings stays here (account-menu move deferred — it
              broke SSR as a UserButton child). */}
          <Link href="/dashboard" className="hover:underline">
            Home
          </Link>
          <Link href="/opportunities" className="hover:underline">
            Opportunities
          </Link>
          <Link href="/portfolio" className="hover:underline">
            Portfolio
          </Link>
          <Link href="/research" className="hover:underline">
            Research
          </Link>
          <Link href="/advisor" className="hover:underline">
            AI Advisor
          </Link>
          <Link href="/learn" className="hover:underline">
            Learn
          </Link>
          <Link href="/paper" className="hover:underline">
            Paper Trading
          </Link>
          <Link href="/settings" className="ml-auto text-slate-500 hover:underline">
            Settings
          </Link>
        </nav>
      </div>
      {children}
    </GlossaryProvider>
  );
}
