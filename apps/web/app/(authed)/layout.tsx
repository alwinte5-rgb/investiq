import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

// ClerkProvider wraps ONLY the authed routes (dashboard, watchlists). These are
// force-dynamic, so they are never statically prerendered — which is why moving
// Clerk here avoids the Next.js prerender "useContext of null" crash on the
// marketing/error pages.
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <div className="mb-6 flex items-center justify-between border-b pb-3 text-sm">
        <nav className="flex items-center gap-4">
          <Link href="/dashboard" className="hover:underline">
            Dashboard
          </Link>
          <Link href="/watchlists" className="hover:underline">
            Watchlists
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
