# 02 — Database Schema

PostgreSQL + Prisma. Full draft in [`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma). This doc explains the model groups, key relations, and integrity rules. IDs are `cuid`. All user-owned rows carry `userId` for object-level authorization. Timestamps (`createdAt`/`updatedAt`) on every table.

## Model groups

### A. Identity & billing
- **User** — mirrors Clerk user (`clerkId` unique). Holds `email`, profile, `plan` (`FREE|INVESTOR|INVESTOR_PLUS`), `role` (`USER|ADMIN`). Clerk is source of truth for auth; User row is source of truth for app data/entitlements.
- **Subscription** — billing state, plan, period start/end, status. One active per user.
- **UsageCounter** — `(userId, metric, periodStart)` unique; tracks AI analyses, etc. for quota gating.
- **Entitlement override** — optional per-user feature grants (admin/comp).

### B. Portfolio & brokerage (SnapTrade)
- **BrokerageConnection** — one per connected SnapTrade authorization. Stores encrypted SnapTrade user secret / auth id, brokerage name, status, last sync. **No live order capability.**
- **Account** — a brokerage account under a connection (cash, total value, currency).
- **Holding** — `(accountId, symbolId)` position: quantity, avg cost, market value, unrealized P/L. Snapshot-updated on sync.
- **Transaction** — historical txns (buy/sell/dividend/transfer) from SnapTrade; immutable history.
- **PortfolioSnapshot** — daily total value / allocation for performance tracking and history charts.

### C. Symbols & market data
- **Symbol** — canonical US equity/ETF: `ticker` (unique), name, `assetType` (`STOCK|ETF`), exchange, sector, industry, active flag. **Universe constrained to US stocks/ETFs.**
- **Quote** / **PriceBar** — cached latest quote and OHLCV bars (also live in Redis; Postgres for history/persistence).
- **Fundamental** — FMP fundamentals (per symbol, periodic).
- **EarningsEvent** — upcoming/past earnings dates + actuals (drives earnings-risk + briefings).
- **AnalystAction** — upgrades/downgrades/price-target changes.
- **SectorPerformance** — sector returns for concentration/relative analysis.

### D. News (L5)
- **NewsArticle** — normalized from Benzinga/MarketAux: source, url, headline, body/summary, published_at, dedupe key.
- **NewsSymbolLink** — many-to-many NewsArticle↔Symbol.
- **NewsImpact** — AI classification per article(+symbol): `POSITIVE|NEUTRAL|NEGATIVE`, rationale, confidence. Stored, not recomputed per view.

### E. Watchlists
- **Watchlist** — `userId`, name. Free tier limited to 1 (enforced server-side).
- **WatchlistItem** — `(watchlistId, symbolId)` unique; optional note.

### F. AI analyses & evidence (L2–L8) — the audit core
- **Analysis** — per `(symbolId)` and/or `(userId, symbolId)` AI output: `recommendationType` (enum of the 8 allowed Watch types), `summary`, `bullCase`, `bearCase`, `keyRisks`, `newsImpactSummary`, `technicalSummary`, `confidenceScore`, `riskScore`, `inputsHash`, `model`, `generatedAt`, `validUntil`. `inputsHash` lets us skip regeneration when inputs are unchanged.
- **AnalysisEvidence** — rows linking an Analysis to the concrete data points used: `sourceType` (PRICE/NEWS/EARNINGS/ANALYST/FUNDAMENTAL/PORTFOLIO/SECTOR), `reference` (id/url), `snapshot` (JSON of the value at generation time), `role` (`SUPPORTING|INVALIDATING`). This is what powers "data sources used / supporting evidence / invalidating factors" and makes every recommendation auditable.
- **PortfolioAnalysis** (L3) — per user: health, sector concentration, risk, diversification, cash scores; over/underweight lists; strengths/weaknesses/improvements (JSON), generatedAt.
- **PortfolioReview** (L4) — `MORNING|WEEKLY|MONTHLY` briefing content per user per period.
- **RiskAssessment** (L6) — per `(userId?, symbolId)`: suggested buy zone, stop loss, profit target, R:R, position size, max risk, warning color, warning reasons.
- **Opportunity** (L8) — per user: type (`BUY_WATCH|ETF|REBUY|HIGH_RISK_HOLDING|REVIEW|AVOID`), score, confidence, risk, explanation, supporting data (JSON), symbolId.

### G. Paper trading (L9, Alpaca paper)
- **PaperAccount** — `userId`, Alpaca paper account ref, cash, equity, status.
- **PaperOrder** — simulated order: symbol, side, qty, type, status, submitted/filled, prices.
- **PaperPosition** — current simulated positions + P/L.
- **PaperPerformanceSnapshot** — equity curve over time.

### H. Learning (L10)
- **LearningContent** — concept library (why support matters, stop losses, earnings risk, etc.), tags.
- **RecommendationLearningLink** — ties an Analysis/recommendation type to relevant LearningContent.

### I. Alerts & notifications
- **AlertRule** — user-defined or system rules (risk threshold, earnings proximity, news impact, price zone).
- **Notification** — delivered items (channel: email/push/in-app), read state, payload, dedupe key.
- **DeviceToken** — Expo/APNs/FCM push tokens per user device.

### J. Platform / admin (L1)
- **FeatureFlag** — `key`, enabled, rollout %, optional targeting; checked server-side.
- **AuditLog** — `actorUserId`, action, targetType, targetId, metadata, ip, createdAt (immutable).
- **ApiCallLog** / **ApiHealthSnapshot** — per-vendor call records + rolled-up health (latency, errors, rate-limit) for the monitoring dashboard.
- **AdminNote** — optional ops notes.

## Key integrity rules
- **Object-level ownership:** every user-scoped query filters by `userId`; never trust client IDs (enforced in `lib/permissions.ts`).
- **No duplicate records:** sync + job writes are idempotent via unique constraints (`@@unique([accountId, symbolId])`, news dedupe key, `inputsHash`, notification dedupe key).
- **Immutable history:** `Transaction`, `AuditLog`, `PortfolioSnapshot` are append-only.
- **Cascade carefully:** deleting a `BrokerageConnection` cascades Accounts→Holdings/Transactions but **must not** orphan AI analyses tied to symbols (symbols are global). Disconnect ≠ delete user history unless requested.
- **Personalized rows never cached statically.**

## Indexing highlights
- `User.clerkId` unique; `Symbol.ticker` unique.
- `Holding @@unique([accountId, symbolId])`; `WatchlistItem @@unique([watchlistId, symbolId])`.
- `Analysis @@index([symbolId, generatedAt])`, `@@unique` on `(userId, symbolId, inputsHash)` where user-scoped.
- `NewsArticle.dedupeKey` unique; `NewsSymbolLink @@index([symbolId, ...])`.
- `UsageCounter @@unique([userId, metric, periodStart])`.
- `AuditLog @@index([actorUserId, createdAt])`, `ApiCallLog @@index([vendor, createdAt])`.
