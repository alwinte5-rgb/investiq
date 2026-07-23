import { z } from "zod";

/**
 * Startup environment validation. Apps/workers call this at boot so the process
 * FAILS FAST when a REQUIRED var is missing. Vendor keys for features that
 * aren't wired/enabled yet are OPTIONAL — the app boots with just a database,
 * Clerk, and (optionally) market/news keys. Code that needs an optional key
 * checks for it and degrades gracefully. Secrets are server-only; never expose
 * them via NEXT_PUBLIC_ / EXPO_PUBLIC_.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // --- Required to boot ---
  DATABASE_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1),
  ALLOWED_ORIGINS: z.string().min(1),

  // Railway provides PORT; fall back to API_PORT for local dev.
  PORT: z.coerce.number().int().positive().optional(),
  API_PORT: z.coerce.number().int().positive().default(4000),

  // Plan gating. OFF for now (review mode) so every feature is reachable while
  // pricing is still being finalized. The pricing tiers + entitlement matrix
  // stay fully defined — set PLAN_GATING_ENABLED=true to re-enable enforcement.
  PLAN_GATING_ENABLED: z.coerce.boolean().default(false),

  // --- Optional: cache/queues (in-memory used until provided) ---
  REDIS_URL: z.string().url().optional(),

  // --- Optional: scheduled jobs (e.g. daily market opportunity scan) ---
  // When set, the /api/v1/cron/* routes accept a `Bearer <CRON_SECRET>` caller
  // (a Railway scheduled job). When unset, those routes return 404 (disabled).
  CRON_SECRET: z.string().min(1).optional(),

  // --- Optional: AI (Layer 2) ---
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().default("claude-opus-4-8"),

  // --- Optional: market data (Massive = ex-Polygon; Twelve Data fallback) ---
  MASSIVE_API_KEY: z.string().min(1).optional(),
  MASSIVE_BASE_URL: z.string().url().default("https://api.polygon.io"),
  TWELVEDATA_API_KEY: z.string().min(1).optional(),

  // --- Optional: news ---
  BENZINGA_API_KEY: z.string().min(1).optional(),
  MARKETAUX_API_KEY: z.string().min(1).optional(),

  // --- Optional: fundamentals/economic ---
  FMP_API_KEY: z.string().min(1).optional(),
  // FRED (free) — macro indicators for the educational "macro context" panel.
  FRED_API_KEY: z.string().min(1).optional(),
  // SEC EDGAR (free, no key) requires a descriptive User-Agent with contact info
  // on every request. Defaulted so filings work out of the box; override with a
  // real contact for production politeness/compliance.
  SEC_USER_AGENT: z.string().min(1).default("InvestIQ/1.0 (support@investiq.app)"),

  // --- Optional: brokerage (SnapTrade, Layer 1 #7) ---
  SNAPTRADE_CLIENT_ID: z.string().min(1).optional(),
  SNAPTRADE_CONSUMER_KEY: z.string().min(1).optional(),
  CONNECTION_ENCRYPTION_KEY: z.string().min(32).optional(),
  // Where the SnapTrade connection portal returns users after "Done". Must also
  // be whitelisted in the SnapTrade dashboard. When unset, the portal has no
  // return link (the "Done" button doesn't navigate back).
  SNAPTRADE_REDIRECT_URI: z.string().url().optional(),

  // --- Optional: paper trading (Alpaca, Layer 9) ---
  ALPACA_PAPER_KEY_ID: z.string().min(1).optional(),
  ALPACA_PAPER_SECRET: z.string().min(1).optional(),
  ALPACA_PAPER_BASE_URL: z.string().url().default("https://paper-api.alpaca.markets"),

  // --- Optional: storage (Supabase) ---
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("investiq"),

  // --- Optional: email (Resend, Layer 4) ---
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().default("noreply@investiq.app"),

  // --- Optional: push ---
  EXPO_ACCESS_TOKEN: z.string().min(1).optional(),

  // --- Optional: Quant Lab bridge ---
  // Shared secret a scheduled push from ~/quant-lab's own cron must present
  // (Bearer <QUANT_LAB_PUSH_SECRET>). Same disabled-by-default-when-unset
  // pattern as CRON_SECRET — the ingest route 404s until this is configured.
  QUANT_LAB_PUSH_SECRET: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof envSchema>;

/** Parse & validate server env. Throws a readable error listing missing vars. */
export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  // Treat empty-string vars as unset (common in .env files) so optional vars
  // with a blank value behave as "not provided" instead of failing min length.
  const cleaned: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(source)) {
    cleaned[k] = v === "" ? undefined : v;
  }
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid/missing environment variables:\n${issues}`);
  }
  return parsed.data;
}

/** The port to listen on: Railway's PORT, else API_PORT. */
export function resolvePort(env: ServerEnv): number {
  return env.PORT ?? env.API_PORT;
}

/** Parse a comma-separated origin allowlist (no wildcard with credentials). */
export function parseAllowedOrigins(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
