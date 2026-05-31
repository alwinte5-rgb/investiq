# Deploying InvestIQ to Railway

This monorepo deploys as **two Railway services + one Postgres**, all from this
one GitHub repo. The mobile app (`apps/mobile`) is **not** deployed here — it
ships to the App Store / Play Store via EAS.

```
Railway project
├── Postgres            (Railway plugin → provides DATABASE_URL)
├── investiq-api        (Node/Fastify — apps/api)
└── investiq-web        (Next.js — apps/web)
```

You can deploy with **Railpack** (Railway's default; recommended — least config)
or with the included **Dockerfiles**. Pick one path per service.

---

## Recommended: Railpack (per-service)

Railway auto-detects the build/start for each workspace. You point each service
at this repo and tell it which workspace to build.

### 1. Add Postgres
Project → **+ New** → **Database** → **PostgreSQL**. This creates a
`DATABASE_URL` you'll reference from the API service.

### 2. API service (`investiq-api`)
- **Source:** this repo.
- **Settings → set the build/start** (or let Railpack detect `@investiq/api`):
  - **Custom Start Command:**
    ```
    npm run -w @investiq/db push && npm run -w @investiq/api start
    ```
    (`db push` creates the tables from the Prisma schema on first deploy; then
    the API starts via `tsx`.)
- **Variables** (Settings → Variables):
  | Key | Value |
  |-----|-------|
  | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
  | `CLERK_SECRET_KEY` | your `sk_test_…` |
  | `CLERK_WEBHOOK_SECRET` | `whsec_…` (or a placeholder until you add the webhook) |
  | `ALLOWED_ORIGINS` | your web service URL, e.g. `https://investiq-web-production.up.railway.app` |
  | `TWELVEDATA_API_KEY` | optional — enables quotes |
  | `MARKETAUX_API_KEY` | optional — enables news |
  | `MASSIVE_API_KEY` | optional — quote fallback |
- The API listens on Railway's `PORT` automatically.

### 3. Web service (`investiq-web`)
- **Source:** this repo. Railpack builds `@investiq/web`.
- **Variables:**
  | Key | Value |
  |-----|-------|
  | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | your `pk_test_…` (**required at build time**) |
  | `API_BASE_URL` | the API service's URL (internal or public) |
  | `NEXT_PUBLIC_API_BASE_URL` | same API URL (used by the browser) |

  > The web build fails with **"Missing publishableKey"** if
  > `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` isn't set — Next prerenders pages wrapped
  > in `ClerkProvider` at build time. Railpack exposes service variables to the
  > build, so just setting it here fixes it.

### 4. First-time data seed (optional)
Once the API is deployed, seed the starter symbol universe once:
```
railway run --service investiq-api npm run -w @investiq/db seed
```

---

## Alternative: Dockerfiles

Each service has a Dockerfile that builds from the **repo root** context.

- **API:** Settings → Build → **Dockerfile Path** = `apps/api/Dockerfile`.
  It runs migrations (`db push` via the start command is recommended) — or change
  the Dockerfile `CMD` to `db push` for a fresh database.
- **Web:** Settings → Build → **Dockerfile Path** = `apps/web/Dockerfile`, and set
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` as a service variable (passed in as a build
  ARG). Keep the Root Directory at the repo root for both.

> The Dockerfiles are provided as-is and mirror the Railpack steps; the Railpack
> path above is the tested one.

---

## Notes / gotchas
- **`packageManager` field** in the root `package.json` is required for Turborepo
  to resolve workspaces — keep it.
- **Prisma client** is generated automatically by the `postinstall` in
  `packages/db` (no DB connection needed for `generate`).
- **No migration files yet** — we use `prisma db push` to create tables from the
  schema. Switch to `prisma migrate` once the schema stabilizes.
- **Secrets** live in Railway Variables, never in the repo. The local `.env` is
  gitignored and only used for local dev.
- **Clerk dev keys** (`pk_test_`/`sk_test_`) are fine to launch with; create a
  Clerk **Production** instance for `pk_live_`/`sk_live_` before going live.
