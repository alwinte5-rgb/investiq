# 03 — API Architecture

The shared backend (`apps/api`) is the single source of business logic for web + iOS + Android. Web may add thin BFF route handlers that proxy to it, but **no business logic lives in route handlers or components**.

## 1. Mandatory request pipeline
Every route handler and server action follows this exact order:
1. **Authentication** — verify Clerk session/JWT server-side (`lib/auth.ts`). Never trust client auth.
2. **Authorization** — object-level ownership check (`lib/permissions.ts`). User A can never read/write User B's resource.
3. **Validation** — Zod schema for body, query, and route params; **reject unknown fields** (`lib/validate.ts`, schemas in `packages/shared`).
4. **Business logic** — `packages/*` + integration clients + AI.
5. **Response** — consistent shape; safe errors.

## 2. Response & error contract
- Success: `{ data: <T> }`
- Error: `{ error: string, code?: string }` — consistent shape everywhere. **No stack traces or internal messages** leaked. Map internal errors to safe codes (`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `QUOTA_EXCEEDED`, `INSUFFICIENT_DATA`).
- Personalized responses set `Cache-Control: no-store`.

## 3. Endpoint map (v1, `/api/v1/...`)
> All routes authenticated unless marked **public**. All user-scoped routes enforce object-level authz.

**Auth / user**
- `GET /me` — current user + plan + entitlements
- `PATCH /me` — update profile
- Clerk webhooks: `POST /webhooks/clerk` (**public**, signature-verified) — sync user create/update/delete

**Billing**
- `GET /billing/subscription`
- `POST /billing/checkout` / `POST /billing/portal`
- `POST /webhooks/billing` (**public**, signature-verified)

**Brokerage (SnapTrade, read-only)**
- `POST /connections` — start SnapTrade connect (returns redirect/portal URL)
- `GET /connections` — list user's connections
- `DELETE /connections/:id` — disconnect (authz: owner)
- `POST /connections/:id/sync` — trigger sync
- `GET /accounts` / `GET /accounts/:id` / `GET /accounts/:id/holdings` / `GET /accounts/:id/transactions`
- `GET /portfolio/summary` · `GET /portfolio/performance` · `GET /portfolio/snapshots`

**Symbols & market data**
- `GET /symbols/search?q=` — US stock/ETF search (constrained universe)
- `GET /symbols/:ticker` · `/quote` · `/bars?interval=` · `/fundamentals` · `/earnings` · `/analyst`
- `GET /market/overview` — indices, sectors, movers

**News**
- `GET /news?symbol=&cursor=` · `GET /news/:id`

**Watchlists**
- `GET /watchlists` · `POST /watchlists` (Free: max 1, enforced) · `PATCH/:id` · `DELETE/:id`
- `POST /watchlists/:id/items` · `DELETE /watchlists/:id/items/:itemId`

**AI analysis (L2)** — quota-gated
- `GET /analysis/:ticker` — latest stored analysis (+ evidence)
- `POST /analysis/:ticker/generate` — generate/refresh (checks quota; returns `INSUFFICIENT_DATA` if bundle incomplete)

**Portfolio intelligence (L3)** — Investor+
- `GET /portfolio/analysis` · `POST /portfolio/analysis/generate`

**Portfolio manager (L4)** — Investor+
- `GET /reviews?period=morning|weekly|monthly` · `GET /reviews/:id`

**Risk (L6)**
- `GET /risk/:ticker` · `POST /risk/:ticker/generate`

**Opportunities (L8)** — Investor+
- `GET /opportunities?type=`

**Paper trading (L9)**
- `POST /paper/accounts` · `GET /paper/accounts` · `GET /paper/accounts/:id`
- `POST /paper/accounts/:id/orders` · `GET .../orders` · `GET .../positions` · `GET .../performance`

**Learning (L10)**
- `GET /learning` · `GET /learning/:slug`

**Alerts / notifications**
- `GET/POST/PATCH/DELETE /alerts` · `GET /notifications` · `POST /notifications/:id/read` · `POST /devices` (push token)

**Admin (role=ADMIN, see doc 08)**
- `/admin/users`, `/admin/flags`, `/admin/api-health`, `/admin/audit`, ...

## 4. AI guardrails (the non-negotiable layer)
The AI is wrapped by `packages/ai`. No route calls Claude directly.

1. **Evidence bundle assembler** — gathers required inputs (portfolio/price/news/earnings/analyst/technical/sector). If any required input is missing/stale → return `INSUFFICIENT_DATA` and the literal user-facing string *"Not enough data available to generate a recommendation."* The model is never called.
2. **Grounded prompt** — system prompt forbids using parametric/market knowledge; the model may only reason over the supplied bundle. Prompt is versioned; `model` + `inputsHash` stored.
3. **Structured output** — model must return JSON matching a Zod schema: `recommendationType` ∈ the 8 allowed enums, summary, bull/bear, keyRisks, newsImpact, technicalSummary, confidenceScore, riskScore, evidence[] (each tagged SUPPORTING/INVALIDATING with a reference into the bundle).
4. **Output validator** — rejects/repairs any output that: uses a forbidden token ("buy now", "sell", direct directives), invents a recommendation type, or cites evidence not present in the bundle. Failing output is discarded, not shown.
5. **Persistence** — valid output stored in `Analysis` + `AnalysisEvidence`. Re-views read storage; regeneration only on inputs change or schedule.
6. **Disclaimer** — every AI surface carries the educational disclaimer.

## 5. Entitlements & quotas
- Central `entitlements(user)` in `packages/shared` returns plan capabilities. Checked **server-side** after auth on every gated route. Never gate only in UI.
- AI generation increments `UsageCounter`; over-quota → `QUOTA_EXCEEDED` with upgrade hint.

## 6. Rate limiting & abuse
- Per-user + per-IP rate limits (Redis) on generation and search endpoints.
- Idempotency keys on mutations that hit vendors (sync, paper orders).
- Vendor calls go through `packages/integrations` with retry + circuit breaker; Polygon failure falls back to Twelve Data transparently.

## 7. Caching rules (enforced)
- Non-personalized market/news data: Redis short-TTL, shareable.
- Personalized: `cache: "no-store"`, no `revalidate`, `Cache-Control: no-store`.
- AI analyses: served from Postgres, not regenerated per request.

## 8. Security checklist (per route)
- [ ] Auth verified server-side
- [ ] Object-level authz (owner check) — IDOR tested
- [ ] Zod validation, unknown fields rejected
- [ ] Entitlement/quota checked where applicable
- [ ] No secret in client; vendor secret server-only
- [ ] Consistent error shape, no leakage
- [ ] Correct caching directive
- [ ] Webhooks signature-verified; CORS allowlisted (no wildcard + credentials)
