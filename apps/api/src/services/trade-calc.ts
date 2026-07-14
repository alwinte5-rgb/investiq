import {
  computeTradeCalc,
  splitPair,
  type RateTable,
  type TradeCalcRequest,
  type TradeCalcResult,
} from "@investiq/shared";
import { getForexSettings } from "./forex-settings.js";
import type { ExchangeRateService } from "./exchange-rates.js";
import type { CalendarService } from "./calendar.js";

/**
 * Trade calculation service — the server-side single source of truth. Merges
 * the user's saved plan settings, any live rates the provider can supply
 * (client-supplied manual rates win), and the upcoming high-impact event check,
 * then delegates every number to the shared PURE engine.
 */

export interface TradeCalcDeps {
  rates: ExchangeRateService;
  calendar: CalendarService;
}

export async function calculateTrade(
  userId: string,
  input: TradeCalcRequest,
  deps: TradeCalcDeps,
): Promise<TradeCalcResult & { settings: { defaultRiskPct: number; maxRiskPct: number; preferredRewardRatio: number } }> {
  const settings = await getForexSettings(userId);
  const defaultRiskPct = Number(settings.defaultRiskPercentage);
  const maxRiskPct = Number(settings.maximumRiskPercentage);
  const preferredRewardRatio = Number(settings.preferredRewardRatio);

  // Rate table: live provider rates (best-effort) under client-supplied rates.
  const parts = splitPair(input.pairSymbol);
  const needed = parts
    ? [
        input.pairSymbol,
        `${parts.quote}/${input.accountCurrency}`,
        `${input.accountCurrency}/${parts.quote}`,
        `${parts.base}/${input.accountCurrency}`,
      ]
    : [input.pairSymbol];
  const live = await deps.rates.getRates(needed);
  const rates: RateTable = { ...live.rates, ...(input.rates ?? {}) };

  // Event awareness: any high-impact event touching either currency within the
  // user's warning window makes the status engine raise a Caution.
  const eventWindow = Number(settings.eventWarningMinutes) || 60;
  const upcoming = parts ? await deps.calendar.upcomingHighImpact([parts.base, parts.quote], eventWindow) : [];

  const result = computeTradeCalc({
    ...input,
    rates,
    defaultRiskPct,
    maxRiskPct,
    preferredRewardRatio,
    highImpactEventSoon: upcoming.length > 0,
  });

  if (upcoming.length > 0) {
    const e = upcoming[0]!;
    const mins = Math.max(1, Math.round((e.eventTime.getTime() - Date.now()) / 60_000));
    result.warnings.push(`High-impact event: ${e.name} (${e.currency}) in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }

  return { ...result, settings: { defaultRiskPct, maxRiskPct, preferredRewardRatio } };
}
