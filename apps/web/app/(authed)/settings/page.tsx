import { apiFetch } from "@/lib/api";
import { NotificationSettingsUI } from "@/components/notification-settings-ui";
import { ForexSettingsUI } from "@/components/forex/forex-settings-ui";
import type { NotificationPreferences } from "./actions";
import type { ForexSettings } from "./forex-actions";

export const dynamic = "force-dynamic"; // personalized — never statically cached

const PREF_DEFAULTS: NotificationPreferences = {
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
  const [forex, prefs] = await Promise.all([
    apiFetch<ForexSettings>("/api/v1/me/forex-settings").catch(() => null),
    apiFetch<NotificationPreferences>("/api/v1/me/notification-preferences").catch(() => null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-500">
          Your trading profile drives every calculator and trade check — set it once, and the app
          measures every setup against it.
        </p>
      </div>

      {forex ? (
        <ForexSettingsUI initial={forex} />
      ) : (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load your trading profile. Refresh to try again.
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Notifications</h2>
        {prefs ? (
          <NotificationSettingsUI initial={prefs} />
        ) : (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Couldn&apos;t load your notification preferences. Refresh to try again.
          </div>
        )}
      </div>
    </div>
  );
}
