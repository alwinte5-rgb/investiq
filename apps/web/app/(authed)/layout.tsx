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
          <Link href="/calculator" className="font-semibold text-blue-700 hover:underline">
            Trade Calculator
          </Link>
          <Link href="/pairs" className="hover:underline">
            Currency Pairs
          </Link>
          <Link href="/sessions" className="hover:underline">
            Market Sessions
          </Link>
          <Link href="/calendar" className="hover:underline">
            Economic Calendar
          </Link>
          <Link href="/planner" className="hover:underline">
            Trade Planner
          </Link>
          <Link href="/journal" className="hover:underline">
            Journal
          </Link>
          <Link href="/learn" className="hover:underline">
            Learn
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
