import type { FastifyInstance } from "fastify";
import { reviewQuerySchema, updateNotificationPreferencesSchema } from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import {
  generateReview,
  getLatestReview,
  getPreferences,
  updatePreferences,
} from "../services/reviews.js";

/**
 * Layer 4 — portfolio reviews + notification preferences. Investor+ only
 * (enforced server-side in the service via the `dailyReviews` entitlement).
 * All responses are personalized -> no-store.
 */
export async function reviewRoutes(app: FastifyInstance, deps: AuthDeps) {
  // Generate (or return the existing) review for the current period.
  app.post("/api/v1/portfolio/reviews", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps);
    const { period } = validate(reviewQuerySchema, req.query);
    reply.header("Cache-Control", "no-store");
    return { data: await generateReview(ctx.userId, ctx.plan, period ?? "MORNING") };
  });

  // Latest stored review (optionally filtered by period).
  app.get("/api/v1/portfolio/reviews", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps);
    const { period } = validate(reviewQuerySchema, req.query);
    reply.header("Cache-Control", "no-store");
    return { data: await getLatestReview(ctx.userId, ctx.plan, period) };
  });

  // Notification preferences (timezone, channels, quiet hours). Available to
  // all authenticated users — gating applies to review *generation*, not prefs.
  app.get("/api/v1/me/notification-preferences", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps);
    reply.header("Cache-Control", "no-store");
    return { data: await getPreferences(ctx.userId) };
  });

  app.patch("/api/v1/me/notification-preferences", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps);
    const patch = validate(updateNotificationPreferencesSchema, req.body);
    reply.header("Cache-Control", "no-store");
    return { data: await updatePreferences(ctx.userId, patch) };
  });
}
