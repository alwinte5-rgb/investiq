import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Protected app routes. UI protection is convenience; the API re-checks
// auth + authz + entitlements on every call regardless.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/portfolio(.*)",
  "/research(.*)",
  "/opportunities(.*)",
  "/paper(.*)",
  "/reviews(.*)",
  "/watchlists(.*)",
  "/admin(.*)",
  "/settings(.*)",
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
