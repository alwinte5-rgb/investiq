# 04 — Mobile Architecture

## 1. Stack
- **Expo (managed) + React Native + TypeScript**, **EAS Build** for iOS/Android binaries.
- **expo-router** (file-based navigation) for parity with web routing mental model.
- **Clerk Expo SDK** for auth (shared identity with web).
- **TanStack Query** for server state, caching, retry, and optimistic updates.
- **Shared API client + Zod types** from `packages/shared` — mobile and web validate identical contracts. No duplicated types.

## 2. App structure (`apps/mobile`)
```
app/                      expo-router routes
  (auth)/sign-in, sign-up
  (tabs)/
    index        Dashboard
    portfolio
    markets      search + market overview
    watchlist
    paper        paper trading
    profile
  symbol/[ticker]         stock/ETF detail + AI analysis + chart
  analysis/[ticker]
  reviews/                briefings
  settings/
components/                UI only
features/                  screen-level logic, hooks (calls shared client)
lib/                       device-side helpers (push registration, secure storage)
```
Business logic stays in the backend; mobile holds presentation + view-state only.

## 3. Navigation model
Bottom tab bar (Dashboard · Portfolio · Markets · Watchlist · Profile) with Paper Trading either as a tab or under Portfolio depending on space. Stack navigation for symbol detail, analysis, reviews, settings. Deep links: `investiq://symbol/AAPL`, `investiq://reviews/morning` (for push taps).

## 4. Charts
TradingView mobile widget via WebView (or `react-native-webview`-hosted advanced chart) with the same overlay payload (buy zones, stop, target, support/resistance, earnings/news events) the backend produces for web. "Show Me Why" renders the same evidence overlay. Charts support the AI; they are not the centerpiece.

## 5. Push notifications
- Register device token (`expo-notifications`) → `POST /devices`.
- Server dispatches via Expo Push (→ APNs/FCM) for: morning briefing, risk warnings (Orange/Red), high-impact news, earnings proximity, opportunity matches.
- Respect per-user alert preferences (`AlertRule`) and quiet hours. Dedupe via notification `dedupeKey`.

## 6. Offline & state
- TanStack Query cache for last-known data with clear stale indicators.
- Personalized data never persisted to insecure storage; tokens in `expo-secure-store`.
- Pull-to-refresh triggers real refetch (and portfolio sync where relevant) — no fake success.

## 7. Platform considerations
- **Port note (local Metro):** assign InvestIQ its own Metro/Expo port to avoid clashing with existing projects (Party Planner 8081 · CartBook 8082 · Comic Garage 8083). Suggested: **8084**.
- Safe-area handling; large-text/dynamic-type support for the beginner audience.
- App Store / Play compliance: clear "educational, not financial advice" disclosure in listing + onboarding; no live trading claims.
- EAS profiles: `development`, `preview`, `production`; OTA updates via EAS Update for JS-only changes.

## 8. Parity contract with web
Same endpoints, same Zod schemas, same entitlement gating (enforced server-side regardless of client). A feature is "done" only when it behaves identically on web and mobile against the shared API.
