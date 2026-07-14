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

export default clerkMiddleware(async (auth, req) => {
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
