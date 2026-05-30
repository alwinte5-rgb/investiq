# 09 — Development Roadmap

**Rule:** layers are built sequentially. No advanced layer ships before its dependencies. Foundation (L1) must work end-to-end — verified, not just rendered — before the AI engine (L2).

## Phase 0 — Scaffolding (pre-L1)
- Turborepo monorepo: `apps/{web,mobile,api}`, `packages/{shared,db,ai,integrations,ui}`.
- Postgres + Prisma (`packages/db`) on Railway; run first migration from the draft schema.
- Clerk auth wired (web + mobile + backend verification).
- `lib/auth.ts`, `lib/permissions.ts`, `lib/validate.ts` scaffolds + `entitlements()` in `packages/shared`.
- Startup env validation (Zod) in every app/worker.
- CI: typecheck, lint, test, Prisma migrate check. Railway services + Redis provisioned.
- **DoD:** a protected `/me` endpoint flows auth→authz→validation→response on web and mobile; env-missing boots fail fast.

## Layer 1 — Foundation MVP
Accounts, brokerage connect (SnapTrade), watchlists, dashboard, news feed, stock/ETF search, market overview, paper account shell, portfolio summary + health score (rule-based v0), performance tracking, responsive web app, mobile shell, DB architecture, **admin panel, API monitoring, audit logs, feature flags**.
- Integrations live: SnapTrade (read), Polygon (+Twelve Data fallback), Benzinga/MarketAux, FMP, Alpaca paper (account create).
- **DoD:** connect a real brokerage in sandbox → holdings persist → dashboard reflects stored data after refresh; search returns US equities/ETFs; admin shows users/flags/API health/audit; caching rules verified (no personalized static cache); IDOR + auth bypass tests pass.

## Layer 2 — AI Analysis Engine
Per-stock: summary, bull/bear, key risks, news impact, technicals, recommendation (8 Watch types), confidence, risk score, **evidence (sources/supporting/invalidating)**.
- Build `packages/ai`: evidence-bundle assembler, grounded prompt, structured output Zod schema, output validator, persistence + `inputsHash`.
- Quota gating via `UsageCounter`.
- **DoD:** complete bundle → valid stored analysis with evidence; incomplete bundle → exact "Not enough data…" string and **no model call**; forbidden/invalid output is discarded; regeneration only on inputs change; quota enforced server-side.

## Layer 3 — Portfolio Intelligence
Portfolio health, sector concentration, risk/diversification/cash scores, over/underweight, strengths/weaknesses, suggested improvements — evidence-backed. (Investor+ gated.)
- **DoD:** thin portfolio → honest "not enough holdings"; scores reproducible from stored inputs; gating server-side.

## Layer 4 — AI Portfolio Manager
Morning briefing, weekly + monthly reviews; daily flags (allocation, earnings risk, position size, opportunity matches).
- Scheduler/workers (pre-market briefing), Resend email + push delivery, `PortfolioReview` persistence (idempotent per period).
- **DoD:** scheduled jobs produce per-user reviews once per period (no duplicates); delivery honors preferences/quiet hours.

## Layer 5 — News Intelligence
Monitor earnings, up/downgrades, filings, insider, launches, partnerships, M&A, gov contracts; classify Positive/Neutral/Negative + explain.
- News ingestion workers, dedupe, `NewsImpact` classification (grounded), feeds into L2 evidence.
- **DoD:** impact classifications stored with rationale; dedupe prevents repeats; reflected in symbol news + alerts.

## Layer 6 — Risk Engine
Buy zone, stop loss, profit target, R:R, position sizing, max risk; Green/Yellow/Orange/Red warnings (earnings, volatility, concentration, news, technical breakdown).
- **DoD:** risk assessments computed from real data, stored, color logic consistent; surfaced on symbol + portfolio.

## Layer 7 — Chart Intelligence
TradingView widgets + overlays (buy/stop/target zones, support/resistance, earnings/news events) + "Show Me Why".
- Backend produces overlay payload shared by web + mobile.
- **DoD:** overlays match the analysis/risk data; "Show Me Why" renders the stored evidence; responsive.

## Layer 8 — Opportunity Engine
Top buy/ETF/rebuy watches, high-risk holdings, positions to review, avoid list — each scored with confidence, risk, explanation, supporting data. (Investor+.)
- **DoD:** opportunities derive from L2–L6 outputs; every item explainable; gating server-side.

## Layer 9 — Paper Trading (full)
Simulated accounts, trades, performance, test recommendations, history (Alpaca paper). No live trading in V1.
- **DoD:** orders idempotent, duplicate-submit blocked, rejections surfaced honestly; equity curve persists; no live-trading path exists.

## Layer 10 — Learning System
Contextual education tied to every recommendation (why support/stop loss/earnings risk matter; why analysts moved).
- **DoD:** each recommendation type links to relevant `LearningContent`; surfaced inline on analysis/risk panels.

## Cross-cutting (every layer, definition of done)
- Auth verified server-side; object-level authz; IDOR + auth-bypass tests.
- Zod validation, unknown fields rejected; validation-failure tests.
- Caching correct (personalized = no-store).
- No secret in client; vendor secrets server-only; webhooks signature-verified; CORS allowlisted.
- Truthful UI: verified persistence before success; distinct loading/empty/error states.
- Regression tests for each bug fix; happy + edge + failure paths covered.
- Feature shipped behind a flag, rolled out via admin.

## Suggested milestones (adjust to team size/budget)
- **M1:** Phase 0 + L1 web (auth, connect, dashboard, search, admin) — the spine.
- **M2:** L1 mobile parity + paper account shell + performance/health v0.
- **M3:** L2 AI engine + quotas + evidence (the differentiator).
- **M4:** L3 portfolio intelligence + L5 news intelligence.
- **M5:** L4 reviews/briefings + L6 risk engine.
- **M6:** L7 charts + L8 opportunities.
- **M7:** L9 full paper trading + L10 learning + hardening/launch.

> Open inputs that will refine timing: team size (solo vs small team), target launch date, and which vendor accounts are already provisioned. Provide these and the milestones can be dated.
