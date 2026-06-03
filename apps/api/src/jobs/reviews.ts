import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { prisma, type NotificationPreference } from "@investiq/db";
import { loadServerEnv, type ReviewContent, type ReviewPeriod } from "@investiq/shared";
import { createResendClient, createExpoPushClient } from "@investiq/integrations";
import { generateReview, getPreferences } from "../services/reviews.js";
import { deliverReview, type DeliveryDeps } from "../services/delivery.js";

/**
 * Scheduled review job (Layer 4). Invoked by a Railway cron per period, e.g.
 *   npm run -w @investiq/api job:reviews -- MORNING
 * Generates each eligible user's review once per period (idempotent) and
 * delivers it honoring channel preferences + quiet hours. Safe to re-run: the
 * (userId, period, periodKey) constraint and per-channel dedupe prevent
 * duplicate reviews or double sends.
 */

const PERIODS: ReviewPeriod[] = ["MORNING", "WEEKLY", "MONTHLY"];

function parsePeriod(argv: string[]): ReviewPeriod {
  const raw = (argv[2] ?? "MORNING").toUpperCase();
  if (!PERIODS.includes(raw as ReviewPeriod)) {
    throw new Error(`Invalid period "${raw}". Use one of: ${PERIODS.join(", ")}`);
  }
  return raw as ReviewPeriod;
}

function periodEnabled(period: ReviewPeriod, prefs: NotificationPreference): boolean {
  switch (period) {
    case "MORNING":
      return prefs.morningBriefing;
    case "WEEKLY":
      return prefs.weeklyReview;
    case "MONTHLY":
      return prefs.monthlyReview;
  }
}

// Local dev convenience: load monorepo-root .env (no-op in production).
function loadDevEnv() {
  if (process.env.NODE_ENV === "production") return;
  const loadEnvFile = (process as { loadEnvFile?: (path: string) => void }).loadEnvFile;
  if (!loadEnvFile) return;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    loadEnvFile.call(process, resolve(here, "../../../../.env"));
  } catch {
    /* rely on ambient env */
  }
}

async function main() {
  loadDevEnv();
  const env = loadServerEnv();
  const period = parsePeriod(process.argv);
  const now = new Date();

  const deps: DeliveryDeps = {
    email: createResendClient({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }),
    push: createExpoPushClient({ accessToken: env.EXPO_ACCESS_TOKEN }),
  };

  // Only Investor+ users are entitled to reviews (gate is re-checked in the service).
  const users = await prisma.user.findMany({
    where: { plan: { in: ["INVESTOR", "INVESTOR_PLUS"] } },
    select: { id: true, email: true, plan: true },
  });

  const stats = { eligible: users.length, generated: 0, existing: 0, insufficient: 0, delivered: 0, failed: 0, skipped: 0 };
  console.log(`[reviews] period=${period} eligible=${users.length} email=${deps.email.enabled} push=${deps.push.enabled}`);

  for (const u of users) {
    try {
      const prefs = await getPreferences(u.id);
      if (!periodEnabled(period, prefs)) {
        stats.skipped += 1;
        continue;
      }

      const result = await generateReview(u.id, u.plan, period, now);
      if (result.status === "insufficient") {
        stats.insufficient += 1;
        continue;
      }
      if (result.status === "created") stats.generated += 1;
      else stats.existing += 1;

      const review = result.review;
      const content =
        result.status === "created"
          ? result.content
          : (review.content as unknown as ReviewContent);

      const report = await deliverReview(
        { userId: u.id, email: u.email, period, periodKey: review.periodKey, content, prefs, now },
        deps,
      );
      if (report.email === "sent" || report.push === "sent" || report.inApp === "recorded") {
        stats.delivered += 1;
      }
      if (report.email === "failed" || report.push === "failed") stats.failed += 1;
    } catch (err) {
      stats.failed += 1;
      console.error(`[reviews] user=${u.id} error:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[reviews] done`, JSON.stringify(stats));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[reviews] fatal:", err instanceof Error ? err.message : err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
