# InvestIQ — Architecture & Planning

**Working name:** InvestIQ
**What it is:** An AI-powered investment *research and education* platform for US stocks and ETFs. Bloomberg-terminal-grade intelligence packaged for everyday long-term investors.
**What it is NOT:** Forex, crypto, day-trading signals, options trading, or a Registered Investment Advisor.

## Legal posture (decided)
**Educational / non-advisory.** InvestIQ presents data-grounded research and analysis. It never issues personalized buy/sell directives. All AI output uses "Watch / Consider / Review" language, is grounded in connected data sources, and ships with disclaimers. This is enforced in code (see `03-api-architecture.md` → AI Guardrails) — not just policy.

> InvestIQ is not a financial advisor, broker-dealer, or RIA. Nothing it produces is personalized investment advice. It surfaces research and education from connected data sources. Investing involves risk of loss.

## Repo posture (decided)
**Turborepo monorepo.** One repo, shared backend serving web + iOS + Android, with shared types/validation in `packages/`.

## The 10 planning artifacts
| # | Document | Purpose |
|---|----------|---------|
| 0 | [Product Architecture](00-product-architecture.md) | Vision, users, layers, monetization, the "grounded AI" contract |
| 1 | [System Architecture](01-system-architecture.md) | Services, data flow, vendors, caching, jobs, infra on Railway |
| 2 | [Database Schema](02-database-schema.md) | Entities, relations, indexes (Prisma draft in `packages/db/prisma/schema.prisma`) |
| 3 | [API Architecture](03-api-architecture.md) | Route contract, auth→authz→validation order, AI guardrails, rate limits |
| 4 | [Mobile Architecture](04-mobile-architecture.md) | Expo/RN structure, navigation, shared code, EAS, push |
| 5 | [Web Architecture](05-web-architecture.md) | Next.js App Router, server/client boundaries, caching rules |
| 6 | [User Flows](06-user-flows.md) | Signup, connect broker, analysis, paper trade, alerts |
| 7 | [Screen Inventory](07-screen-inventory.md) | Every screen, web + mobile, with states |
| 8 | [Admin Architecture](08-admin-architecture.md) | Admin panel, API monitoring, audit logs, feature flags |
| 9 | [Development Roadmap](09-development-roadmap.md) | Layer-by-layer sequencing, milestones, definition of done |

## Build order (non-negotiable)
Layers are built sequentially. Foundation (Layer 1) must work end-to-end before the AI engine (Layer 2). No advanced layer ships before its dependencies. See the roadmap.

## Status
Planning phase. **No application code written yet.** Next step after sign-off: scaffold the Turborepo monorepo and stand up Layer 1.
