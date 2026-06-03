import { z } from "zod";
import { isValidTimeZone } from "../reviews.js";

/** Review period query param for GET /portfolio/reviews. */
export const reviewPeriodSchema = z.enum(["MORNING", "WEEKLY", "MONTHLY"]);

export const reviewQuerySchema = z
  .object({ period: reviewPeriodSchema.optional() })
  .strict();

/** Minutes from local midnight (0..1439), used for quiet-hours bounds. */
const minutesOfDay = z.number().int().min(0).max(1439);

/**
 * Body for PATCH /me/notification-preferences. All fields optional (partial
 * update); unknown fields rejected. Quiet hours must be set/cleared together so
 * a half-configured window can never be stored.
 */
export const updateNotificationPreferencesSchema = z
  .object({
    timezone: z.string().refine(isValidTimeZone, "Invalid IANA timezone").optional(),
    emailEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
    morningBriefing: z.boolean().optional(),
    weeklyReview: z.boolean().optional(),
    monthlyReview: z.boolean().optional(),
    quietHoursStart: minutesOfDay.nullable().optional(),
    quietHoursEnd: minutesOfDay.nullable().optional(),
  })
  .strict()
  .refine(
    (v) => {
      // If quiet hours appear in this patch, both bounds must be present and
      // share nullability (both numbers = set, both null = cleared) so a
      // half-configured window can never be persisted.
      const hasStart = "quietHoursStart" in v;
      const hasEnd = "quietHoursEnd" in v;
      if (!hasStart && !hasEnd) return true;
      if (hasStart !== hasEnd) return false;
      return (v.quietHoursStart == null) === (v.quietHoursEnd == null);
    },
    { message: "quietHoursStart and quietHoursEnd must be set or cleared together" },
  );

export type UpdateNotificationPreferences = z.infer<typeof updateNotificationPreferencesSchema>;
