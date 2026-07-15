import { prisma } from "@investiq/db";
import { errors, isValidTimeZone, type ForexSettingsPatch } from "@investiq/shared";

/**
 * User forex settings — the plan every calculator and trade check measures
 * against (account currency/balance, default & max risk %, leverage, preferred
 * reward ratio, lot display, timezone, beginner mode). Upsert-with-defaults so
 * a fresh user always has a usable profile.
 */

const SETTINGS_SELECT = {
  accountCurrency: true,
  defaultAccountBalance: true,
  defaultRiskPercentage: true,
  maximumRiskPercentage: true,
  defaultLeverage: true,
  preferredRewardRatio: true,
  preferredLotDisplay: true,
  timezone: true,
  eventWarningMinutes: true,
  beginnerMode: true,
  eventBlockEnabled: true,
  experienceLevel: true,
  updatedAt: true,
} as const;

/** Prisma Decimal → number for the API contract. */
function serialize<T extends Record<string, unknown>>(row: T) {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      v != null && typeof v === "object" && "toNumber" in (v as object) ? Number(v) : v,
    ]),
  );
}

export async function getForexSettings(userId: string) {
  const row = await prisma.userForexSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: SETTINGS_SELECT,
  });
  return serialize(row);
}

export async function updateForexSettings(userId: string, patch: ForexSettingsPatch) {
  if (patch.timezone && !isValidTimeZone(patch.timezone)) {
    throw errors.validation(`Unknown timezone: ${patch.timezone}`);
  }
  // Max risk must stay >= default risk — compare against the merged result.
  const current = await getForexSettings(userId);
  const nextDefault = patch.defaultRiskPercentage ?? Number(current.defaultRiskPercentage);
  const nextMax = patch.maximumRiskPercentage ?? Number(current.maximumRiskPercentage);
  if (nextDefault > nextMax) {
    throw errors.validation(
      `Default risk (${nextDefault}%) cannot exceed your maximum risk (${nextMax}%). Raise the maximum first.`,
    );
  }
  const row = await prisma.userForexSettings.update({
    where: { userId },
    data: patch,
    select: SETTINGS_SELECT,
  });
  return serialize(row);
}
