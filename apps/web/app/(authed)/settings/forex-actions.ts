"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

export interface ForexSettings {
  accountCurrency: string;
  defaultAccountBalance: number;
  defaultRiskPercentage: number;
  maximumRiskPercentage: number;
  defaultLeverage: number;
  preferredRewardRatio: number;
  preferredLotDisplay: "UNITS" | "LOTS";
  timezone: string;
  eventWarningMinutes: number;
  beginnerMode: boolean;
  experienceLevel: string | null;
}

export type ForexSettingsPatch = Partial<ForexSettings>;

export type ForexSettingsResult =
  | { ok: true; settings: ForexSettings }
  | { ok: false; error: string };

export async function updateForexSettingsAction(patch: ForexSettingsPatch): Promise<ForexSettingsResult> {
  try {
    const settings = await apiFetch<ForexSettings>("/api/v1/me/forex-settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return { ok: true, settings };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save settings";
    if (/authentication required|unauthorized|\b401\b/i.test(msg)) redirect("/sign-in");
    return { ok: false, error: msg };
  }
}
