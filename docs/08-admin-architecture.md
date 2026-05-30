# 08 — Admin Architecture

Admin is part of L1 Foundation (operability from day one). Web-only, `role === ADMIN`, enforced **server-side** on every admin route (UI guard is convenience only). Every admin action is recorded in `AuditLog`.

## 1. Access control
- `role` on `User` (`USER|ADMIN`). Promotion is a manual/seeded operation, itself audit-logged.
- Admin API namespace `/api/v1/admin/*` re-checks auth + `role` on each call. No object is reachable without it. Admin reads of user data are logged (who viewed what).

## 2. Modules
### A. Admin Dashboard
KPIs: active users by plan, new signups, connected accounts, AI analyses generated (quota burn), vendor health summary, error rate, paper accounts. Read-only rollups.

### B. User management
- List/search users; view detail (plan, role, connections count, usage, subscription status).
- Actions: change plan/role, grant comp **entitlement override**, suspend, resend verification. All write actions audit-logged with actor + target.
- **Never** expose another user's secrets/tokens; brokerage secrets are encrypted and not rendered.

### C. API monitoring (L1 requirement)
- Per-vendor (SnapTrade, Polygon, Twelve Data, Benzinga, MarketAux, FMP, Alpaca, Claude, Clerk, Resend): call volume, error rate, p95 latency, rate-limit headroom — from `ApiCallLog` / `ApiHealthSnapshot`.
- Fallback visibility: show when Polygon→Twelve Data failover is active.
- Alerting hooks when a vendor degrades (error rate / latency thresholds).

### D. Audit logs (L1 requirement)
- Searchable, filterable (actor, action, target, date). Immutable, append-only.
- Captures: auth-sensitive events, admin actions, billing/plan changes, connection create/delete, AI generation events, feature-flag changes.

### E. Feature flags (L1 requirement)
- CRUD on `FeatureFlag` (`key`, enabled, rolloutPct, targeting). Checked server-side in `packages/shared`.
- Used to gate each layer/feature during sequential rollout (e.g., turn on L5 news intelligence for a cohort). Flag changes audit-logged.

### F. Content management
- Manage `LearningContent` (L10) library: create/edit concepts, tags, link to recommendation types.

## 3. Operational guardrails
- All admin mutations validated (Zod) and audit-logged with before/after metadata where relevant.
- Destructive actions (suspend, delete connection) require explicit confirm and are reversible where feasible; deletes avoid orphaning data (cascade rules per schema).
- Admin cannot impersonate to place paper orders or generate billing changes silently — such actions, if added later, must be explicitly logged and flagged.

## 4. Build note
Admin ships in L1 as a thin but real panel (users, flags, API health, audit). It expands as later layers add monitorable surfaces (AI generation metrics in L2, review/alert dispatch stats in L4/L5).
