# 05 — Web Architecture

## 1. Stack
- **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui.**
- **Clerk** (Next SDK) for auth; middleware protects app routes.
- **TanStack Query** for client-side server-state where interactivity is needed; React Server Components for initial data.
- Shared **Zod schemas + API client + types** from `packages/shared`.

## 2. Rendering & boundaries
- **Server Components** fetch initial, non-interactive data through the shared API client.
- **Client Components** for interactive widgets (charts, forms, live quotes, optimistic updates) — marked `"use client"`, no secrets, no direct DB access.
- **Components are UI-only:** no auth checks, no business logic, no direct data fetching beyond the typed client. Logic lives in `packages/*` / backend.
- A thin set of Next **route handlers** may act as a BFF proxy to `apps/api` (attaching the Clerk token) but carry **no business logic**.

## 3. Caching rules (critical)
- **Personalized data** (portfolio, holdings, analyses, paper account, watchlists): `cache: "no-store"`, never `revalidate`, response `Cache-Control: no-store`. No personalized data in static cache.
- **Non-personalized** (symbol search results, market overview, public news): short revalidation / Redis-backed at the API layer.
- Use `dynamic = "force-dynamic"` (or `no-store` fetches) on authenticated pages to avoid serving one user's data to another.

## 4. Route structure (App Router)
```
app/
  (marketing)/            public: landing, pricing, about, legal/disclaimer
  (auth)/sign-in, sign-up (Clerk)
  (app)/                  protected (middleware-guarded)
    dashboard/
    portfolio/            summary, performance, health
    markets/              search, overview, sectors
    symbol/[ticker]/      detail: quote, chart, AI analysis, risk, news, learning
    watchlists/
    opportunities/        (Investor+)
    reviews/              morning / weekly / monthly (Investor+)
    paper/                accounts, trade, performance
    learning/
    settings/             profile, connections, billing, alerts
  admin/                  role=ADMIN (doc 08)
  api/                    BFF route handlers (thin proxy)
```

## 5. Auth & protection
- Clerk middleware guards `(app)/*` and `admin/*`.
- **Server-side enforcement is authoritative** — the UI guard is convenience only; the API re-checks auth + authz + entitlements on every call. Never trust client-only gating.
- Admin routes additionally check `role === ADMIN` server-side.

## 6. State & truthful UI
- Forms: controlled inputs, disabled + spinner during submit (prevents duplicate submission), inline validation mirroring server Zod.
- **No success toast without verified persistence** — mutations await the real response and reconcile cache; on failure, show real error UI and roll back optimistic state.
- Distinct **loading / empty / error** states everywhere; empty states must not mask failed fetches (separate "no data" from "fetch failed").
- After mutations, invalidate the relevant query keys so displayed data matches stored data (no stale-after-save).

## 7. Charts
TradingView Advanced Chart / widget embedded in a client component; backend supplies the overlay payload (zones, support/resistance, events) and "Show Me Why" evidence. Responsive: chart collapses gracefully on mobile widths; critical controls never hidden.

## 8. Responsiveness & accessibility
- Mobile-first; tables become cards/stacked layouts on small screens; modals/popovers usable on touch.
- Keyboard navigable; sufficient contrast; dynamic type friendly (beginner audience).
- Disabled states prevent accidental duplicate actions.

## 9. Performance & SEO
- Marketing routes statically generated + SEO metadata; app routes dynamic + no-store.
- Code-split heavy widgets (charts) and AI panels.
