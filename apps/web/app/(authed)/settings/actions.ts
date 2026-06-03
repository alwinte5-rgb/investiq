"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

export interface NotificationPreferences {
  timezone: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  morningBriefing: boolean;
  weeklyReview: boolean;
  monthlyReview: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

export type PrefsPatch = Partial<NotificationPreferences>;

export type PrefsActionResult =
  | { ok: true; prefs: NotificationPreferences }
  | { ok: false; error: string };

export async function updatePreferencesAction(patch: PrefsPatch): Promise<PrefsActionResult> {
  try {
    const prefs = await apiFetch<NotificationPreferences>("/api/v1/me/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return { ok: true, prefs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save preferences";
    if (/authentication required|unauthorized|\b401\b/i.test(msg)) redirect("/sign-in");
    return { ok: false, error: msg };
  }
}
