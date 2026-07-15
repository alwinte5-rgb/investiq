/**
 * Zod schemas for the forex platform — requests are `.strict()` so unknown
 * fields are REJECTED at the API boundary. Direction anomalies (a buy stop
 * above entry, etc.) are calculator WARNINGS, never validation failures.
 */

import { z } from "zod";
import { ACCOUNT_CURRENCIES } from "../forex/pips.js";

export const accountCurrencySchema = z.enum(ACCOUNT_CURRENCIES);

/** Canonical pair form "EUR/USD"; also accepts "EURUSD" and normalizes. */
export const pairSymbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((s) => (/^[A-Z]{6}$/.test(s) ? `${s.slice(0, 3)}/${s.slice(3)}` : s))
  .pipe(z.string().regex(/^[A-Z]{3}\/[A-Z]{3}$/, "Invalid currency pair (expected e.g. EUR/USD)"));

export const tradeDirectionSchema = z.enum(["BUY", "SELL"]);
export const tradePlanStatusSchema = z.enum(["DRAFT", "PLANNED", "ENTERED", "CLOSED", "CANCELLED"]);
export const lotDisplaySchema = z.enum(["UNITS", "LOTS"]);
export const impactLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

const positive = z.coerce.number().positive();
const positiveOrNull = z.coerce.number().positive().nullish();
const pct = z.coerce.number().gt(0).max(100);

/** Body for POST /trade-calc (and the planner's pre-save check). */
export const tradeCalcRequestSchema = z
  .object({
    accountBalance: positive,
    accountCurrency: accountCurrencySchema,
    pairSymbol: pairSymbolSchema,
    direction: tradeDirectionSchema,
    entryPrice: positive,
    stopLossPrice: positiveOrNull,
    stopLossPips: positiveOrNull,
    takeProfitPrice: positiveOrNull,
    takeProfitPips: positiveOrNull,
    riskPercentage: pct,
    leverage: positive,
    positionUnitsOverride: positiveOrNull,
    lotSizeOverride: positiveOrNull,
    rates: z.record(z.string(), z.number().positive()).optional(),
    spreadPips: z.coerce.number().min(0).nullish(),
    commission: z.coerce.number().min(0).nullish(),
    swap: z.coerce.number().nullish(),
  })
  .strict();
export type TradeCalcRequest = z.infer<typeof tradeCalcRequestSchema>;

/** Body for PATCH /me/forex-settings — everything optional (partial update). */
export const forexSettingsPatchSchema = z
  .object({
    accountCurrency: accountCurrencySchema.optional(),
    defaultAccountBalance: positive.optional(),
    defaultRiskPercentage: pct.optional(),
    maximumRiskPercentage: pct.optional(),
    defaultLeverage: positive.max(1000).optional(),
    preferredRewardRatio: positive.max(100).optional(),
    preferredLotDisplay: lotDisplaySchema.optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    eventWarningMinutes: z.coerce.number().int().min(0).max(24 * 60).optional(),
    beginnerMode: z.boolean().optional(),
    eventBlockEnabled: z.boolean().optional(),
    experienceLevel: z.enum(["beginner", "intermediate", "advanced"]).nullish(),
  })
  .strict();
export type ForexSettingsPatch = z.infer<typeof forexSettingsPatchSchema>;

const tradePlanCore = {
  pairSymbol: pairSymbolSchema,
  direction: tradeDirectionSchema,
  entryPrice: positive,
  stopLossPrice: positiveOrNull,
  takeProfitPrice: positiveOrNull,
  riskPercentage: pct,
  accountBalance: positive,
  leverage: positive,
  positionUnitsOverride: positiveOrNull,
  lotSizeOverride: positiveOrNull,
  reasoning: z.string().trim().max(4000).optional(),
  strategyTag: z.string().trim().max(60).optional(),
  session: z.string().trim().max(40).optional(),
  emotionalState: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(4000).optional(),
};

/** Body for POST /trade-plans. */
export const tradePlanCreateSchema = z
  .object({ ...tradePlanCore, status: tradePlanStatusSchema.default("DRAFT") })
  .strict();
export type TradePlanCreate = z.infer<typeof tradePlanCreateSchema>;

/** Body for PATCH /trade-plans/:id — all optional. */
export const tradePlanUpdateSchema = z
  .object({ ...tradePlanCore, status: tradePlanStatusSchema })
  .partial()
  .strict();
export type TradePlanUpdate = z.infer<typeof tradePlanUpdateSchema>;

const journalCore = {
  pairSymbol: pairSymbolSchema,
  direction: tradeDirectionSchema,
  tradePlanId: z.string().trim().min(1).optional(),
  plannedEntry: positiveOrNull,
  actualEntry: positiveOrNull,
  plannedExit: positiveOrNull,
  actualExit: positiveOrNull,
  plannedStop: positiveOrNull,
  actualStop: positiveOrNull,
  plannedTarget: positiveOrNull,
  actualTarget: positiveOrNull,
  plannedUnits: positiveOrNull,
  actualUnits: positiveOrNull,
  plannedRisk: positiveOrNull,
  actualRisk: positiveOrNull,
  profitLossAmount: z.coerce.number().nullish(),
  profitLossPips: z.coerce.number().nullish(),
  session: z.string().trim().max(40).optional(),
  strategyTag: z.string().trim().max(60).optional(),
  rulesFollowed: z.boolean().nullish(),
  emotionalState: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(4000).optional(),
  lessons: z.string().trim().max(4000).optional(),
  openedAt: z.coerce.date().nullish(),
  closedAt: z.coerce.date().nullish(),
};

/** Body for POST /journal. */
export const journalEntryCreateSchema = z.object(journalCore).strict();
export type JournalEntryCreate = z.infer<typeof journalEntryCreateSchema>;

/** Body for PATCH /journal/:id — all optional. */
export const journalEntryUpdateSchema = z.object(journalCore).partial().strict();
export type JournalEntryUpdate = z.infer<typeof journalEntryUpdateSchema>;

/** Query for GET /calendar/events. */
export const calendarQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    currency: z.string().trim().toUpperCase().length(3).optional(),
    impact: impactLevelSchema.optional(),
    savedOnly: z.coerce.boolean().optional(),
  })
  .strict();
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

/** Body for POST /me/saved-pairs. */
export const savedPairCreateSchema = z.object({ pairSymbol: pairSymbolSchema }).strict();

/** Query for GET /rates. */
export const ratesQuerySchema = z
  .object({ pairs: z.string().trim().min(1).max(300) })
  .strict();

/** Query for GET /sessions. */
export const sessionsQuerySchema = z
  .object({ tz: z.string().trim().min(1).max(64).optional() })
  .strict();
