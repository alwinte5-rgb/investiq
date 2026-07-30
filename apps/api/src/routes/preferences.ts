import type { FastifyInstance } from "fastify";
import { prisma } from "@investiq/db";
import {
  updateNotificationPreferencesSchema,
  type UpdateNotificationPreferences,
} from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";

/** Notification preferences (timezone, channels, quiet hours).
 *
 * Extracted from the retired stock-era reviews route — the /settings page has
 * always called these endpoints, but they previously lived in an UNREGISTERED
 * route file, so the panel silently fell back to defaults and saved nowhere.
 * This is the minimal registered home for them. */

function getPreferences(userId: string) {
  // Upsert-on-read so callers always get a complete row of defaults.
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

function updatePreferences(userId: string, patch: UpdateNotificationPreferences) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...patch },
    update: patch,
  });
}

export interface PreferencesRouteDeps {
  auth: AuthDeps;
}

export async function preferencesRoutes(app: FastifyInstance, deps: PreferencesRouteDeps) {
  app.get("/api/v1/me/notification-preferences", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    reply.header("Cache-Control", "no-store");
    return { data: await getPreferences(ctx.userId) };
  });

  app.patch("/api/v1/me/notification-preferences", async (req, reply) => {
    const ctx = await resolveAuthContext(req, deps.auth);
    const patch = validate(updateNotificationPreferencesSchema, req.body);
    reply.header("Cache-Control", "no-store");
    return { data: await updatePreferences(ctx.userId, patch) };
  });
}
