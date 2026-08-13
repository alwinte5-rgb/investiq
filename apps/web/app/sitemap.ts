import type { MetadataRoute } from "next";

// TODO: replace with the real production domain once one is registered.
//
// example.com is reserved by RFC 2606 and can never become a live site, so a
// build that ships with this value is visibly unfinished rather than quietly
// pointing search engines at a domain somebody else owns. Set SITE_URL in the
// deploy environment and nothing here needs to change.
const BASE_URL = process.env.SITE_URL ?? "https://example.com";

// Only the routes that are reachable without a session. The protected set is
// defined once, in middleware.ts — its `isProtectedRoute` matcher is the source
// of truth, and this list is its complement.
const PUBLIC_ROUTES: {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}[] = [
  { path: "", priority: 1, changeFrequency: "weekly" },
  { path: "/calculators/position-size", priority: 0.8, changeFrequency: "monthly" },
  { path: "/disclosures", priority: 0.5, changeFrequency: "yearly" },
  { path: "/sign-up", priority: 0.5, changeFrequency: "monthly" },
  { path: "/sign-in", priority: 0.3, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE_URL}${path}`,
    changeFrequency,
    priority,
  }));
}
