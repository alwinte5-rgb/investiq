# 06 — User Flows

Each flow lists the happy path plus the failure/edge handling QA must verify. "Truthful UI" applies throughout: no success state without verified persistence; failures are surfaced.

## 1. Signup & onboarding
1. Land on marketing → Sign up (Clerk).
2. Clerk webhook → backend creates `User` (plan=FREE). UI waits for `/me` to confirm before entering app.
3. Onboarding: educational disclaimer acknowledgement (recorded), goals/experience (light, non-suitability), optional connect broker now or later.
- **Edge:** Clerk created but webhook delayed → `/me` provisions lazily (find-or-create) so the user is never stuck. Disclaimer must be acknowledged before AI features unlock.

## 2. Connect brokerage (SnapTrade)
1. Settings → Connections → "Connect account" → `POST /connections` returns SnapTrade portal URL.
2. User authorizes at SnapTrade → redirect back → backend stores `BrokerageConnection` (secret encrypted) → triggers first sync.
3. UI shows syncing state → on completion shows accounts/holdings.
- **Free tier:** max 1 connected account (enforced server-side; UI shows upgrade prompt on attempt #2).
- **Edge:** auth abandoned (no connection created → no false success); sync fails (show error + retry, not a fake empty portfolio); disconnect cascades accounts/holdings but preserves global symbol data.

## 3. View dashboard
1. Dashboard aggregates: portfolio summary, health score, performance, watchlist movers, top news, market overview, any morning briefing (Investor+).
- **States:** no connection → onboarding empty state (not an error); fetch failure → visible error with retry; partial data → show what loaded, flag what failed. Health score shows "insufficient data" rather than a fake number when inputs are missing.

## 4. Search & view a symbol
1. Search (US stocks/ETFs only) → symbol detail: quote, chart, fundamentals, earnings, news, AI analysis, risk, learning.
- **Edge:** non-US/unsupported instrument → clear "not supported" message; missing data sections degrade independently (news can load while fundamentals fail).

## 5. Generate AI analysis (L2)
1. On symbol detail, request analysis → backend assembles evidence bundle.
2. If complete → Claude (grounded) → validated output stored → render: summary, bull/bear, key risks, news impact, technicals, recommendation (Watch type), confidence, risk, **evidence (sources + supporting + invalidating)**, disclaimer.
3. If incomplete → show exactly *"Not enough data available to generate a recommendation."*
- **Quota:** Free tier limited; over-quota → upgrade prompt (`QUOTA_EXCEEDED`), no partial/fake analysis.
- **Edge:** invalid model output discarded (never shown); regeneration only when inputs change.

## 6. Watchlists
1. Create watchlist (Free: 1) → add symbols → see quotes/news/analysis hooks.
- **Edge:** duplicate add prevented by unique constraint; remove is confirmed and persisted before UI updates.

## 7. Portfolio intelligence & reviews (L3/L4, Investor+)
1. Portfolio analysis: health, sector concentration, risk/diversification/cash scores, over/underweight, strengths/weaknesses, improvements — all evidence-backed.
2. Morning briefing / weekly / monthly reviews delivered in-app + email/push.
- **Edge:** thin/empty portfolio → "not enough holdings to analyze"; gating enforced server-side.

## 8. Risk & opportunities (L6/L8)
1. Risk panel: buy zone, stop, target, R:R, position size, max risk, color warning + reasons.
2. Opportunities list: scored buy/ETF/rebuy watches, high-risk holdings, positions to review, avoid list.
- All carry explanation + supporting data; warnings use Green/Yellow/Orange/Red consistently.

## 9. Paper trading (L9)
1. Create paper account (Alpaca paper) → place simulated order → see positions, P/L, equity curve, history.
- **Edge:** duplicate submit blocked (disabled state + idempotency key); order rejection surfaced honestly; no live trading anywhere in V1.

## 10. Alerts & notifications
1. Configure alert rules → receive in-app/email/push when triggered.
- **Edge:** dedupe prevents repeat spam; respects quiet hours; unsubscribe honored.

## 11. Billing / upgrade
1. Upgrade Free→Investor→Investor Plus via checkout → webhook updates `Subscription`/`plan` → entitlements expand immediately on next `/me`.
- **Edge:** downgrade reduces access on next check (server-side); never grant access on client state alone; failed payment → `past_due` handling.

## 12. Session / auth edge cases
- Expired session → redirect to sign-in, return to intended route after.
- Logout clears client state + tokens.
- Refresh mid-action preserves or safely re-fetches state; navigation away does not leave a half-written record.
