# 07 — Screen Inventory

Web (Next.js) and Mobile (Expo) share the same information architecture and the same backend. Each screen lists its **states** QA must verify: **L**oading · **E**mpty · **E**rror · **S**uccess/data. Personalized screens are no-store.

## Public / marketing (web only)
| Screen | Notes |
|---|---|
| Landing | value prop, disclaimer |
| Pricing | Free / Investor / Investor Plus |
| About / Legal / Disclaimer | "educational, not advice" |
| Sign in / Sign up | Clerk |

## Onboarding (web + mobile)
| Screen | States |
|---|---|
| Disclaimer acknowledgement | S (recorded) |
| Profile/goals (light) | L/E/S |
| Connect broker (optional) | L/E/Err/S |

## Core app (web + mobile)
| Screen | Key content | States |
|---|---|---|
| **Dashboard** | portfolio summary, health score, performance, watchlist movers, top news, market overview, morning briefing (Investor+) | L/E/Err/S; "insufficient data" for scores |
| **Portfolio — Summary** | total value, allocation, accounts, holdings table | L/E(no connection)/Err/S |
| **Portfolio — Performance** | equity curve, returns, snapshots | L/E/Err/S |
| **Portfolio — Health/Intelligence** (L3, Investor+) | health/risk/diversification/cash scores, sector concentration, over/underweight, strengths/weaknesses/improvements | L/E(thin portfolio)/Err/S |
| **Markets — Overview** | indices, sectors, movers | L/Err/S |
| **Markets — Search** | US stock/ETF search | L/E(no results)/Err/S |
| **Symbol detail** | quote, chart (overlays), fundamentals, earnings, analyst, news, AI analysis, risk panel, learning | each section L/E/Err/S independently |
| **AI Analysis panel** (L2) | summary, bull/bear, risks, news impact, technicals, recommendation (Watch), confidence, risk, evidence (sources/supporting/invalidating), disclaimer | L/Err/S + "Not enough data…" state + quota state |
| **Risk panel** (L6) | buy zone, stop, target, R:R, position size, max risk, color warning + reasons | L/E/Err/S |
| **Chart + "Show Me Why"** (L7) | TradingView widget + overlays | L/Err/S |
| **Watchlists — list** | user watchlists | L/E/Err/S; Free max 1 |
| **Watchlist — detail** | items + quotes/news hooks | L/E/Err/S |
| **Opportunities** (L8, Investor+) | scored buy/ETF/rebuy/high-risk/review/avoid | L/E/Err/S |
| **Reviews** (L4, Investor+) | morning / weekly / monthly briefings | L/E/Err/S |
| **News feed** (L5) | articles + impact classification | L/E/Err/S |
| **Paper — accounts** | list/create | L/E/Err/S |
| **Paper — trade** | order ticket, positions, P/L | L/Err/S; disabled-on-submit |
| **Paper — performance** | equity curve, history | L/E/Err/S |
| **Learning** (L10) | concept library + contextual links | L/E/Err/S |
| **Notifications/Alerts** | inbox + rule config | L/E/Err/S |
| **Settings — Profile** | name, avatar (Supabase Storage), disclaimer status | L/Err/S |
| **Settings — Connections** | manage SnapTrade connections, sync, disconnect | L/E/Err/S |
| **Settings — Billing** | plan, upgrade/downgrade, invoices | L/Err/S |
| **Settings — Alerts/Notifications** | channels, quiet hours | L/Err/S |

## Admin (web only, role=ADMIN) — see doc 08
| Screen |
|---|
| Admin Dashboard (KPIs) |
| Users (list, detail, plan/role, comp entitlements) |
| API Monitoring (per-vendor health, latency, errors, quota) |
| Audit Logs (searchable) |
| Feature Flags (toggle, rollout %) |
| Content (Learning library) |

## Cross-cutting UI requirements
- Every screen distinguishes **empty** (no data yet) from **error** (fetch failed).
- Every mutating control has a disabled/loading state to prevent duplicate submission.
- Every AI surface shows the educational disclaimer and (where applicable) evidence.
- Mobile never hides critical controls; tables become cards on small widths.
