import { z } from "zod";

/**
 * Startup environment validation. Apps/workers call the relevant parser at
 * boot so the process FAILS FAST when a required var is missing — no service
 * starts with a missing secret. Secrets are server-only; never expose them via
 * NEXT_PUBLIC_ / EXPO_PUBLIC_.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1),

  ANTHROPIC_API_KEY: z.string().min(1),
  AI_MODEL: z.string().default("claude-opus-4-8"),

  SNAPTRADE_CLIENT_ID: z.string().min(1),
  SNAPTRADE_CONSUMER_KEY: z.string().min(1),
  CONNECTION_ENCRYPTION_KEY: z.string().min(32),

  ALPACA_PAPER_KEY_ID: z.string().min(1),
  ALPACA_PAPER_SECRET: z.string().min(1),
  ALPACA_PAPER_BASE_URL: z.string().url().default("https://paper-api.alpaca.markets"),

  POLYGON_API_KEY: z.string().min(1),
  TWELVEDATA_API_KEY: z.string().min(1),

  BENZINGA_API_KEY: z.string().min(1),
  MARKETAUX_API_KEY: z.string().min(1),
  FMP_API_KEY: z.string().min(1),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().default("investiq"),

  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email(),

  API_PORT: z.coerce.number().int().positive().default(4000),
  ALLOWED_ORIGINS: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverSchema>;

/** Parse & validate server env. Throws a readable error listing missing vars. */
export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = serverSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid/missing environment variables:\n${issues}`);
  }
  return parsed.data;
}

/** Parse a comma-separated origin allowlist (no wildcard with credentials). */
export function parseAllowedOrigins(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
