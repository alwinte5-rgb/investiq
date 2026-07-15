import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  calendarQuerySchema,
  cuidSchema,
  forexSettingsPatchSchema,
  isValidTimeZone,
  journalEntryCreateSchema,
  journalEntryUpdateSchema,
  pairSymbolSchema,
  ratesQuerySchema,
  savedPairCreateSchema,
  sessionsQuerySchema,
  sessionsSnapshot,
  tradeDirectionSchema,
  formatInUserZone,
  tradeCalcRequestSchema,
  tradePlanCreateSchema,
  tradePlanUpdateSchema,
} from "@investiq/shared";
import { validate } from "../lib/validate.js";
import { resolveAuthContext, type AuthDeps } from "../lib/guard.js";
import { getForexSettings, updateForexSettings } from "../services/forex-settings.js";
import { getPair, listPairs, listSavedPairs, removeSavedPair, savePair } from "../services/pairs.js";
import { calculateTrade, type TradeCalcDeps } from "../services/trade-calc.js";
import {
  checkTradePlan,
  createTradePlan,
  deleteTradePlan,
  listTradePlans,
  openPlannedRisk,
  plansEventExposure,
  updateTradePlan,
} from "../services/trade-plans.js";
import {
  createJournalEntry,
  deleteJournalEntry,
  journalAnalytics,
  listJournalEntries,
  updateJournalEntry,
} from "../services/journal.js";
import type { ExchangeRateService } from "../services/exchange-rates.js";
import type { CalendarService } from "../services/calendar.js";
import type { ForexMarketService } from "../services/forex-market.js";

const idParam = z.object({ id: cuidSchema }).strict();
const pairParam = z.object({ symbol: pairSymbolSchema }).strict();
const insightQuerySchema = z
  .object({
    direction: tradeDirectionSchema.default("BUY"),
    entry: z.coerce.number().positive().optional(),
  })
  .strict();

export interface ForexRouteDeps {
  auth: AuthDeps;
  rates: ExchangeRateService;
  calendar: CalendarService;
  market: ForexMarketService;
}

/**
 * Forex routes — settings, pairs, rates, trade calc, trade plans, journal,
 * calendar, sessions. Every handler follows the pipeline:
 * authenticate -> authorize -> validate -> service -> { data }. Personalized
 * responses are no-store.
 */
export async function forexRoutes(app: FastifyInstance, deps: ForexRouteDeps) {
  const { auth } = deps;
  const calcDeps: TradeCalcDeps = { rates: deps.rates, calendar: deps.calendar };

  // ── Settings ────────────────────────────────────────────────────────────
  app.get("/api/v1/me/forex-settings", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    reply.header("Cache-Control", "no-store");
    return { data: await getForexSettings(ctx.userId) };
  });

  app.patch("/api/v1/me/forex-settings", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    const patch = validate(forexSettingsPatchSchema, req.body);
    reply.header("Cache-Control", "no-store");
    // Ensure the row exists before a partial update (fresh users).
    await getForexSettings(ctx.userId);
    return { data: await updateForexSettings(ctx.userId, patch) };
  });

  // ── Currency pairs (catalog is static reference; auth for one caching policy) ──
  app.get("/api/v1/pairs", async (req, reply) => {
    await resolveAuthContext(req, auth);
    reply.header("Cache-Control", "no-store");
    return { data: await listPairs() };
  });

  app.get("/api/v1/pairs/:symbol", async (req, reply) => {
    await resolveAuthContext(req, auth);
    // Route params carry "EUR-USD" (slash-free); normalize to canonical form.
    const raw = (req.params as { symbol?: string }).symbol ?? "";
    const { symbol } = validate(pairParam, { symbol: raw.replace(/-/g, "/") });
    reply.header("Cache-Control", "no-store");
    return { data: await getPair(symbol) };
  });

  // ── Pair insight: live rate + ATR-based suggested stop/TP (editable) ────
  app.get("/api/v1/pairs/:symbol/insight", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    const raw = (req.params as { symbol?: string }).symbol ?? "";
    const { symbol } = validate(pairParam, { symbol: raw.replace(/-/g, "/") });
    const { direction, entry } = validate(insightQuerySchema, req.query);
    const settings = await getForexSettings(ctx.userId);
    reply.header("Cache-Control", "no-store");
    const insight = await deps.market.getInsight(symbol, direction, entry ?? null, Number(settings.preferredRewardRatio));
    // Informational event context: the pair's HIGH/MEDIUM releases in the next 48h.
    const parts = symbol.split("/");
    const upcomingEvents = await deps.calendar.upcomingEvents(parts, 48 * 60);
    return { data: { ...insight, upcomingEvents } };
  });

  // ── Saved pairs (watchlist) ─────────────────────────────────────────────
  app.get("/api/v1/me/saved-pairs", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    reply.header("Cache-Control", "no-store");
    return { data: await listSavedPairs(ctx.userId) };
  });

  app.post("/api/v1/me/saved-pairs", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    const { pairSymbol } = validate(savedPairCreateSchema, req.body);
    reply.header("Cache-Control", "no-store");
    reply.code(201);
    return { data: await savePair(ctx.userId, pairSymbol) };
  });

  app.delete("/api/v1/me/saved-pairs/:id", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    const { id } = validate(idParam, req.params);
    await removeSavedPair(ctx.userId, id);
    reply.header("Cache-Control", "no-store");
    return { data: { deleted: true } };
  });

  // ── Exchange rates (live when a provider is wired; stale/empty otherwise) ──
  app.get("/api/v1/rates", async (req, reply) => {
    await resolveAuthContext(req, auth);
    const { pairs } = validate(ratesQuerySchema, req.query);
    reply.header("Cache-Control", "no-store");
    return { data: await deps.rates.getRates(pairs.split(",")) };
  });

  // ── Trade calculator (the main product feature) ─────────────────────────
  app.post("/api/v1/trade-calc", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    const input = validate(tradeCalcRequestSchema, req.body);
    reply.header("Cache-Control", "no-store");
    return { data: await calculateTrade(ctx.userId, input, calcDeps) };
  });

  // ── Trade plans ─────────────────────────────────────────────────────────
  app.get("/api/v1/trade-plans", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    reply.header("Cache-Control", "no-store");
    const [plans, openRisk, exposure] = await Promise.all([
      listTradePlans(ctx.userId),
      openPlannedRisk(ctx.userId),
      plansEventExposure(ctx.userId, deps.calendar),
    ]);
    return { data: { plans, openRisk, exposure } };
  });

  app.post("/api/v1/trade-plans/check", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    const input = validate(tradePlanCreateSchema, req.body);
    reply.header("Cache-Control", "no-store");
    return { data: await checkTradePlan(ctx.userId, input, calcDeps) };
  });

  app.post("/api/v1/trade-plans", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    const input = validate(tradePlanCreateSchema, req.body);
    reply.header("Cache-Control", "no-store");
    reply.code(201);
    return { data: await createTradePlan(ctx.userId, ctx.plan, input, calcDeps) };
  });

  app.patch("/api/v1/trade-plans/:id", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    const { id } = validate(idParam, req.params);
    const patch = validate(tradePlanUpdateSchema, req.body);
    reply.header("Cache-Control", "no-store");
    return { data: await updateTradePlan(ctx.userId, id, patch, calcDeps) };
  });

  app.delete("/api/v1/trade-plans/:id", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    const { id } = validate(idParam, req.params);
    await deleteTradePlan(ctx.userId, id);
    reply.header("Cache-Control", "no-store");
    return { data: { deleted: true } };
  });

  // ── Journal ─────────────────────────────────────────────────────────────
  app.get("/api/v1/journal", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    reply.header("Cache-Control", "no-store");
    return { data: await listJournalEntries(ctx.userId) };
  });

  app.post("/api/v1/journal", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    const input = validate(journalEntryCreateSchema, req.body);
    reply.header("Cache-Control", "no-store");
    reply.code(201);
    return { data: await createJournalEntry(ctx.userId, input, deps.calendar) };
  });

  app.patch("/api/v1/journal/:id", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    const { id } = validate(idParam, req.params);
    const patch = validate(journalEntryUpdateSchema, req.body);
    reply.header("Cache-Control", "no-store");
    return { data: await updateJournalEntry(ctx.userId, id, patch, deps.calendar) };
  });

  app.delete("/api/v1/journal/:id", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    const { id } = validate(idParam, req.params);
    await deleteJournalEntry(ctx.userId, id);
    reply.header("Cache-Control", "no-store");
    return { data: { deleted: true } };
  });

  app.get("/api/v1/journal/analytics", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    reply.header("Cache-Control", "no-store");
    return { data: await journalAnalytics(ctx.userId) };
  });

  // ── Economic calendar ───────────────────────────────────────────────────
  app.get("/api/v1/calendar/events", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    const query = validate(calendarQuerySchema, req.query);
    reply.header("Cache-Control", "no-store");
    return { data: await deps.calendar.listEvents(ctx.userId, query) };
  });

  // ── Market sessions (DST-aware; server-side for mobile parity) ──────────
  app.get("/api/v1/sessions", async (req, reply) => {
    const ctx = await resolveAuthContext(req, auth);
    const { tz } = validate(sessionsQuerySchema, req.query);
    const userTz =
      tz && isValidTimeZone(tz)
        ? tz
        : (await getForexSettings(ctx.userId)).timezone as string;
    const snapshot = sessionsSnapshot();
    reply.header("Cache-Control", "no-store");
    return {
      data: {
        ...snapshot,
        userTimeZone: userTz,
        sessions: snapshot.sessions.map((s) => ({
          ...s,
          userLocalOpen: formatInUserZone(s.nextOpenAt, userTz),
          userLocalClose: formatInUserZone(s.nextCloseAt, userTz),
        })),
      },
    };
  });
}
