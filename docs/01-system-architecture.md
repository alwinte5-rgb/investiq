# 01 — System Architecture

## 1. Topology (Turborepo monorepo)
```
investiq/
├── apps/
│   ├── web/          Next.js (App Router, TS, Tailwind, shadcn/ui) — UI + thin BFF route handlers
│   ├── mobile/       Expo / React Native (TS) — consumes core API
│   └── api/          Node + TS service (Fastify or Nest) — the shared backend, all business logic
├── packages/
│   ├── shared/       Zod schemas, TS types, API client, entitlements, recommendation enums
│   ├── db/           Prisma schema + client + migrations
│   ├── ai/           Claude prompt builders, evidence-bundle assembler, output validators
│   ├── integrations/ Vendor clients (SnapTrade, Polygon, TwelveData, Benzinga, MarketAux, FMP, Alpaca)
│   └── ui/           Shared design tokens / primitives where feasible
├── prisma/           (symlink/source for packages/db)
└── docs/
```
**Why monorepo:** the backend is shared across 3 clients; `packages/shared` gives web and mobile identical types and validation with zero duplication — directly satisfies the "shared backend" requirement.

## 2. Services & responsibilities
- **`apps/api` (system of record for logic):** auth verification, authorization, validation, business logic, vendor orchestration, AI calls, jobs. Stateless; scales horizontally on Railway.
- **`apps/web`:** renders UI; server components fetch through the API client; a thin set of Next route handlers may proxy to `apps/api` (BFF) but contain **no business logic** (per project rules, logic lives in `lib`/`packages`).
- **`apps/mobile`:** calls `apps/api` directly via the shared client; Clerk for auth tokens.
- **Workers:** background jobs run as separate Railway services/processes (data sync, AI batch reviews, news ingestion, alert dispatch).

## 3. Data flow (every request)
```
Client → Clerk-verified request
      → apps/api
        → Authentication  (lib/auth.ts — verify Clerk session/JWT server-side)
        → Authorization   (lib/permissions.ts — object-level: user owns the resource)
        → Validation      (lib/validate.ts — Zod; reject unknown fields)
        → Business logic  (packages/* ; vendor clients; AI)
        → Safe response   ({ data } | { error, code })
```
This order is mandatory and identical for route handlers and server actions.

## 4. Vendor integrations & roles
| Concern | Primary | Fallback / notes |
|---|---|---|
| Brokerage connect (holdings, txns, balances, history) | **SnapTrade** | — (read-only; no order placement) |
| Paper trading | **Alpaca Paper** | sandbox keys; no live trading V1 |
| Market data (price, aggregates, technicals input, volume) | **Polygon.io** | **Twelve Data** fallback on error/rate-limit |
| News | **Benzinga** + **MarketAux** | dedupe + merge by ticker/time |
| Earnings, fundamentals, economic, analyst | **Financial Modeling Prep** | — |
| Auth | **Clerk** | server-side verification only |
| AI | **Claude API** | grounded prompts only; output validated |
| Email | **Resend** | briefings, alerts, transactional |
| Push | **Expo Push / FCM+APNs** | alerts, briefings |
| File storage | **Supabase Storage** | avatars, exports, report PDFs |
| DB | **PostgreSQL + Prisma** | on Railway |
| Hosting | **Railway** | per-app services + workers + Postgres + Redis |

**Integration rules:** each vendor is wrapped in `packages/integrations` behind a typed interface so fallbacks/swaps are localized. All vendor secrets are server-only (never `NEXT_PUBLIC_`). All vendor responses are normalized to internal types before use.

## 5. Caching strategy
- **Market data (non-personalized):** cache in Redis with short TTLs (quotes ~10–30s, aggregates minutes, fundamentals hours). Safe to share across users.
- **News:** cache per-symbol windows; dedupe.
- **Personalized data (holdings, portfolio, AI analyses, paper account):** **never** statically cached. Fetches use `cache: "no-store"`; responses set `Cache-Control: no-store`. No `revalidate` on personalized data.
- **AI analyses:** persisted in Postgres (not re-generated on every view); regenerated on a schedule or on material data change, keyed by symbol + inputs hash.

## 6. Background jobs / scheduler
Run as worker processes (BullMQ on Redis, or Railway cron):
- **Portfolio sync** — periodic SnapTrade pull; on-demand refresh.
- **Market/news ingestion** — poll Polygon/Benzinga/MarketAux; normalize; store; emit events.
- **AI batch** — nightly per-symbol analysis refresh; L4 morning briefing (per-user, pre-market); weekly/monthly reviews.
- **Alert engine** — evaluate rules (risk thresholds, news impact, earnings proximity) → Resend/push.
- **Quota reset** — period rollover for `UsageCounter`.

Jobs are idempotent and keyed to avoid duplicate records (data-integrity rule).

## 7. Environments & config
- **Env validation at startup** (Zod) in every app/worker — fail fast on missing required vars. No service boots with a missing secret.
- Environments: `local`, `staging`, `production` on Railway. Separate vendor keys per env (Alpaca paper, Polygon, etc.).
- Secrets in Railway env (server-only). Client gets only `NEXT_PUBLIC_` *non-secret* values (e.g., Clerk publishable key, public API base URL).

## 8. Observability
- **API monitoring:** per-vendor latency, error rate, rate-limit headroom, quota burn (surfaced in admin, see doc 08).
- **Structured logging** with request IDs; no stack traces or internal errors leaked to clients.
- **Audit logs:** all sensitive/admin/state-changing actions recorded (see DB `AuditLog`).
- **Health checks** per service for Railway.

## 9. Security posture (system level)
- Server-side auth on every protected path; object-level authz everywhere (no IDOR).
- Reject unknown input fields; validate body/query/route params.
- No wildcard CORS with credentials; explicit origin allowlist for web + mobile.
- State-changing requests verify origin / use Clerk session + CSRF protection where applicable.
- SnapTrade/Alpaca tokens encrypted at rest; never sent to client.
