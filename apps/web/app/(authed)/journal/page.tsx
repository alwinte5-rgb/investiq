import { apiFetch } from "@/lib/api";
import { JournalUI } from "@/components/forex/journal-ui";
import type { JournalAnalytics, JournalRow } from "./actions";

export const dynamic = "force-dynamic";

interface ForexSettings {
  accountCurrency: string;
}

export default async function JournalPage() {
  const [entries, analytics, settings] = await Promise.all([
    apiFetch<JournalRow[]>("/api/v1/journal").catch(() => [] as JournalRow[]),
    apiFetch<JournalAnalytics>("/api/v1/journal/analytics").catch(() => null),
    apiFetch<ForexSettings>("/api/v1/me/forex-settings").catch(() => null),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Trading Journal</h1>
        <p className="text-sm text-slate-500">
          Record what you planned, what actually happened, and what you learned. Over time, the
          analytics surface patterns about your process — not just your profits.
        </p>
      </div>

      <JournalUI
        initialEntries={entries}
        initialAnalytics={analytics}
        accountCurrency={settings?.accountCurrency ?? "USD"}
      />
    </div>
  );
}
