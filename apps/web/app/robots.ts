import type { MetadataRoute } from "next";

// TODO: replace with the real production domain once one is registered.
// See the note in sitemap.ts — example.com is RFC 2606 reserved on purpose.
const BASE_URL = process.env.SITE_URL ?? "https://example.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // Stated explicitly because robots.txt matches on prefix, and a bare
      // "/calculator" would also block the PUBLIC "/calculators/*" pages —
      // the same trap middleware.ts calls out for its route matcher. The
      // "$" anchor below keeps the two apart; this allow is belt and braces.
      allow: ["/", "/calculators/", "/disclosures"],
      // Everything behind Clerk, mirroring `isProtectedRoute` in
      // middleware.ts, plus the API. None of it has SEO value and a crawler
      // hitting it only ever gets a redirect.
      disallow: [
        "/admin",
        "/advisor",
        "/alpaca",
        "/api/",
        "/bots",
        "/calculator$",
        "/calculator/",
        "/calendar",
        "/crypto",
        "/dashboard",
        "/forex",
        "/futures",
        "/ideas",
        "/journal",
        "/learn",
        "/options",
        "/pairs",
        "/planner",
        "/research",
        "/sessions",
        "/settings",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
