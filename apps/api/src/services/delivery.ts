import { prisma, Prisma, type NotificationPreference } from "@investiq/db";
import {
  isWithinQuietHours,
  localMinutes,
  type ReviewContent,
  type ReviewPeriod,
} from "@investiq/shared";
import type { EmailClient, PushClient } from "@investiq/integrations";

export interface DeliveryDeps {
  email: EmailClient;
  push: PushClient;
}

export interface DeliverReviewInput {
  userId: string;
  email: string | null;
  period: ReviewPeriod;
  periodKey: string;
  content: ReviewContent;
  prefs: NotificationPreference;
  now?: Date;
}

type ChannelOutcome =
  | "sent"
  | "recorded"
  | "duplicate"
  | "skipped_quiet_hours"
  | "skipped_disabled"
  | "skipped_no_address"
  | "skipped_no_tokens"
  | "failed";

export interface DeliveryReport {
  inApp: ChannelOutcome;
  email: ChannelOutcome;
  push: ChannelOutcome;
}

/** Claim a notification dedupe key. Returns true if newly created, false if a
 * row already exists (already delivered → idempotent, never re-send). */
async function claim(data: Prisma.NotificationUncheckedCreateInput): Promise<boolean> {
  try {
    await prisma.notification.create({ data });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

function dedupeKey(userId: string, period: ReviewPeriod, periodKey: string, channel: string): string {
  return `${userId}:review:${period}:${periodKey}:${channel}`;
}

function renderHtml(content: ReviewContent): string {
  const flagItems =
    content.flags.length === 0
      ? "<li>No items to review.</li>"
      : content.flags.map((f) => `<li><strong>${f.title}.</strong> ${f.detail}</li>`).join("");
  return [
    `<h2>${content.headline}</h2>`,
    `<p>${content.summary}</p>`,
    `<ul>${flagItems}</ul>`,
    `<p style="color:#888;font-size:12px">Educational information only — not investment advice.</p>`,
  ].join("");
}

/**
 * Deliver a generated review across channels, honoring preferences and quiet
 * hours. In-app notifications are always recorded; quiet hours and per-channel
 * toggles only gate email/push. Each channel is dedupe-claimed before sending,
 * so a re-run never double-delivers; a failed send releases its claim so a
 * later run can retry.
 */
export async function deliverReview(
  input: DeliverReviewInput,
  deps: DeliveryDeps,
): Promise<DeliveryReport> {
  const { userId, period, periodKey, content, prefs } = input;
  const now = input.now ?? new Date();
  const title = content.headline;
  const body = content.summary;
  const payload = { period, periodKey } as Prisma.InputJsonValue;

  const quiet = isWithinQuietHours(
    localMinutes(now, prefs.timezone),
    prefs.quietHoursStart,
    prefs.quietHoursEnd,
  );

  // --- in-app: always recorded (quiet hours do not suppress in-app) ---
  const inAppClaimed = await claim({
    userId,
    channel: "in_app",
    title,
    body,
    payload,
    dedupeKey: dedupeKey(userId, period, periodKey, "in_app"),
  });
  const report: DeliveryReport = {
    inApp: inAppClaimed ? "recorded" : "duplicate",
    email: "skipped_disabled",
    push: "skipped_disabled",
  };

  // --- email ---
  if (!prefs.emailEnabled || !deps.email.enabled) {
    report.email = "skipped_disabled";
  } else if (!input.email) {
    report.email = "skipped_no_address";
  } else if (quiet) {
    report.email = "skipped_quiet_hours";
  } else {
    const key = dedupeKey(userId, period, periodKey, "email");
    const claimed = await claim({ userId, channel: "email", title, body, payload, dedupeKey: key });
    if (!claimed) {
      report.email = "duplicate";
    } else {
      try {
        await deps.email.send({ to: input.email, subject: title, html: renderHtml(content) });
        report.email = "sent";
      } catch {
        await prisma.notification.deleteMany({ where: { dedupeKey: key } });
        report.email = "failed";
      }
    }
  }

  // --- push ---
  if (!prefs.pushEnabled || !deps.push.enabled) {
    report.push = "skipped_disabled";
  } else if (quiet) {
    report.push = "skipped_quiet_hours";
  } else {
    const tokens = (await prisma.deviceToken.findMany({ where: { userId }, select: { token: true } })).map(
      (d) => d.token,
    );
    if (tokens.length === 0) {
      report.push = "skipped_no_tokens";
    } else {
      const key = dedupeKey(userId, period, periodKey, "push");
      const claimed = await claim({ userId, channel: "push", title, body, payload, dedupeKey: key });
      if (!claimed) {
        report.push = "duplicate";
      } else {
        try {
          const res = await deps.push.send(tokens, { title, body, data: { period, periodKey } });
          if (res.invalidTokens.length > 0) {
            await prisma.deviceToken.deleteMany({ where: { token: { in: res.invalidTokens } } });
          }
          if (res.sent > 0) {
            report.push = "sent";
          } else {
            // Nothing was actually delivered (no valid tokens, or every ticket
            // errored — e.g. bad EXPO_ACCESS_TOKEN). Release the claim so a later
            // run retries instead of marking it "sent" and never delivering.
            await prisma.notification.deleteMany({ where: { dedupeKey: key } });
            report.push = "failed";
          }
        } catch {
          await prisma.notification.deleteMany({ where: { dedupeKey: key } });
          report.push = "failed";
        }
      }
    }
  }

  return report;
}
