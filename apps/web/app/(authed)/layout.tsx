import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

// ClerkProvider wraps ONLY the authed routes (dashboard, watchlists). These are
// force-dynamic, so they are never statically prerendered — which is why moving
// Clerk here avoids the Next.js prerender "useContext of null" crash on the
// marketing/error pages.
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
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
        <SignedOut>
          <SignInButton mode="modal" />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
      {children}
    </ClerkProvider>
  );
}
