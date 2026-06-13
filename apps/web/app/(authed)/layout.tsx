import Link from "next/link";
import { GlossaryProvider } from "@/components/term";

// In-app sub-nav for the authed routes. The ClerkProvider + account menu live in
// the root layout header, so this layout only renders navigation.
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlossaryProvider>
      <div className="mb-6 flex items-center justify-between gap-3 border-b pb-3 text-sm">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/dashboard" className="hover:underline">
            Dashboard
          </Link>
          <Link href="/research" className="hover:underline">
            Research
          </Link>
          <Link href="/portfolio" className="hover:underline">
            Portfolio
          </Link>
          <Link href="/opportunities" className="hover:underline">
            Opportunities
          </Link>
          <Link href="/paper" className="hover:underline">
            Paper Trading
          </Link>
          <Link href="/reviews" className="hover:underline">
            Reviews
          </Link>
          <Link href="/watchlists" className="hover:underline">
            Watchlists
          </Link>
          <Link href="/settings" className="hover:underline">
            Settings
          </Link>
        </nav>
      </div>
      {children}
    </GlossaryProvider>
  );
}
