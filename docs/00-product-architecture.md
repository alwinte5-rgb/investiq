# 00 — Product Architecture

## 1. Vision
InvestIQ helps everyday investors make better decisions by combining portfolio analysis, market data, news, technical analysis, AI explanations, risk management, paper trading, and coaching — all grounded in real connected data. It feels like Bloomberg Terminal for regular people, ChatGPT for investing, and a simplified TradingView, with an AI portfolio coach on top.

The product exists to answer: *What should I watch to buy? Hold? Trim? Review for exit? Why? What changed? What are the risks? What am I missing? Is my portfolio healthy?*

## 2. Target users
- **Primary:** beginner investors, long-term investors, ETF investors, busy professionals, new brokerage account owners.
- **Explicitly not for:** professional traders, hedge funds, HFT, options traders.

Design consequence: defaults favor clarity, plain-English explanation, and risk awareness over speed, density, and exotic instruments.

## 3. The grounded-AI contract (the product's core promise)
The AI **never** generates recommendations from general/parametric knowledge. Every analysis is produced from a structured **evidence bundle** assembled by the backend from connected sources:
- Portfolio holdings, transactions, balances, history (SnapTrade)
- Price + technicals + volume (Polygon.io → Twelve Data fallback)
- News (Benzinga, MarketAux)
- Earnings / fundamentals / economic data (Financial Modeling Prep)
- Analyst activity, sector performance

If the evidence bundle is missing required inputs, the AI returns exactly:
> "Not enough data available to generate a recommendation."

Every AI output must carry: **data sources used**, **supporting evidence**, **invalidating factors**, a **confidence score**, and a **risk score**. These are stored alongside the analysis for auditability (see DB `Analysis` / `AnalysisEvidence`).

### Allowed recommendation types (educational, non-directive)
`Strong Buy Watch` · `Buy Watch` · `Hold` · `Trim Position` · `Exit Consideration` · `High Risk Warning` · `Avoid` · `Rebuy Watch`

**Forbidden:** raw "BUY" / "SELL" commands, personalized directives, price guarantees, anything implying a fiduciary recommendation. Enforced by a typed enum + an output validator (see `03-api-architecture.md`).

## 4. Product layers (capability map)
Each layer is a product capability tier. They map 1:1 to the build roadmap and must be built in order.

| Layer | Capability | Depends on |
|------|------------|-----------|
| **L1 Foundation MVP** | Accounts, portfolio connections, watchlists, dashboard, news feed, stock/ETF search, market overview, paper account, portfolio summary + health score, performance, web app, mobile shell, DB, admin, API monitoring, audit logs, feature flags | — |
| **L2 AI Analysis Engine** | Per-stock: summary, bull/bear, key risks, news impact, technicals, recommendation, confidence, risk score, evidence | L1 + data pipelines |
| **L3 Portfolio Intelligence** | Portfolio health, sector concentration, risk/diversification/cash scores, over/underweight, strengths/weaknesses, suggested improvements | L2 |
| **L4 AI Portfolio Manager** | Morning briefing, weekly + monthly reviews, daily flags | L3 + scheduler |
| **L5 News Intelligence** | Monitor earnings, up/downgrades, filings, insider, launches, partnerships, M&A, gov contracts; classify impact + explain | L2 |
| **L6 Risk Engine** | Buy zone, stop loss, profit target, R:R, position sizing, max risk, color warnings | L2/L3 |
| **L7 Chart Intelligence** | TradingView widgets + overlays (zones, support/resistance, events) + "Show Me Why" | L2/L6 |
| **L8 Opportunity Engine** | Top buy/ETF/rebuy watches, high-risk holdings, positions to review, avoid list, scored | L2–L6 |
| **L9 Paper Trading** | Simulated accounts, trades, performance, test recommendations, history (no live trading in V1) | L1 (Alpaca paper) |
| **L10 Learning System** | Contextual education tied to each recommendation | L2+ |

## 5. Monetization (tiers)
| Tier | Includes |
|------|----------|
| **Free** | 1 connected account, 1 watchlist, limited AI analyses (quota) |
| **Investor** | Unlimited watchlists, portfolio intelligence (L3), daily AI reviews (L4), news intelligence (L5) |
| **Investor Plus** | Multiple portfolios, advanced AI analysis, historical pattern engine, priority alerts, advanced coaching |

Gating is enforced server-side via a central `entitlements` helper (`packages/shared`), checked in every route after auth. AI analysis quotas are tracked per-user per-period in `UsageCounter`. Never gate only in the UI.

## 6. Cross-cutting product principles
- **Truthful UI:** no success state without verified persistence; no empty state masking a failed fetch; toasts reflect real outcomes.
- **Explainability first:** charts support the AI, they are not the product.
- **US equities + ETFs only:** symbol universe is constrained at the data layer; reject non-US / non-equity instruments early.
- **Risk-forward:** every opportunity is paired with its risks; warnings use a consistent Green/Yellow/Orange/Red scale.
- **Education baked in:** every recommendation is a teaching moment (L10).

## 7. Out of scope for V1
Live trading, options, crypto, forex, social/copy trading, tax-lot optimization, multi-currency. (Schema leaves room but features are flagged off.)
