import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Protected app routes. UI protection is convenience; the API re-checks
// auth + authz + entitlements on every call regardless. The public
// /calculators/* pages and /disclosures are intentionally NOT listed.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  // Exact + subpaths only — "/calculator(.*)" would also swallow the PUBLIC
  // /calculators/* pages ("(.*)"" matches the trailing "s/…").
  "/calculator",
  "/calculator/(.*)",
  "/pairs(.*)",
  "/sessions(.*)",
  "/calendar(.*)",
  "/planner(.*)",
  "/journal(.*)",
  "/advisor(.*)",
  "/learn(.*)",
  "/admin(.*)",
  "/settings(.*)",
  // Legacy stock-era routes (now redirect stubs) stay protected.
  "/portfolio(.*)",
  "/research(.*)",
  "/opportunities(.*)",
  "/paper(.*)",
  "/reviews(.*)",
  "/watchlists(.*)",
]);

// TEMPORARY guest mode: bypass Clerk middleware ENTIRELY. Running
// clerkMiddleware at all triggers Clerk's dev-instance browser handshake
// (__clerk_hs_reason=dev-browser-missing) on matched routes, which redirects
// crawlers/agents even when auth.protect() is skipped. The API serves
// un-tokened requests as a shared guest user. Unset GUEST_MODE and rebuild to
// restore login.
const guestMode = process.env.GUEST_MODE === "true";

export default guestMode
  ? function middleware() {
      return NextResponse.next();
    }
  : clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) {
        await auth.protect();
      }
    });

export const config = {
  matcher: [
    // Skip Next internals and static files, run on everything else.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
