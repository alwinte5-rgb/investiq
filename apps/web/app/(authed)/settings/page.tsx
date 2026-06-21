import { apiFetch } from "@/lib/api";
import { NotificationSettingsUI } from "@/components/notification-settings-ui";
import type { NotificationPreferences } from "./actions";

export const dynamic = "force-dynamic"; // personalized — never statically cached

const DEFAULTS: NotificationPreferences = {
  timezone: "America/New_York",
  emailEnabled: true,
  pushEnabled: true,
  morningBriefing: true,
  weeklyReview: true,
  monthlyReview: true,
  quietHoursStart: null,
  quietHoursEnd: null,
};

export default async function SettingsPage() {
  let prefs: NotificationPreferences = DEFAULTS;
  let error: string | null = null;

  try {
    prefs = await apiFetch<NotificationPreferences>("/api/v1/me/notification-preferences");
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load preferences";
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-500">Notification preferences for reviews & briefings.</p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load your preferences: {error}
        </div>
      ) : (
        <NotificationSettingsUI initial={prefs} />
      )}
    </div>
  );
}
