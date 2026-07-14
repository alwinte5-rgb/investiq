import { createHash } from "node:crypto";
import { prisma } from "@investiq/db";
import { fetchJson } from "@investiq/integrations";
import type { EconomicCalendarProvider } from "./calendar.js";

/**
 * Forex Factory weekly calendar provider (free, keyless JSON feed).
 * Ingests this week's scheduled releases into the EconomicEvent table,
 * idempotent on a deterministic externalId. Awareness data only — the product
 * never derives trade direction from events.
 */

interface FfEvent {
  title?: string;
  country?: string; // actually the CURRENCY code in this feed (USD, EUR, …)
  date?: string; // ISO with offset
  impact?: string; // High | Medium | Low | Holiday
  forecast?: string;
  previous?: string;
}

const FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const CURRENCIES = new Set(["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "NZD", "CHF"]);

function mapImpact(impact: string | undefined): "LOW" | "MEDIUM" | "HIGH" {
  const v = (impact ?? "").toLowerCase();
  if (v === "high") return "HIGH";
  if (v === "medium") return "MEDIUM";
  return "LOW"; // Low, Holiday, unknown
}

export function createForexFactoryCalendarProvider(): EconomicCalendarProvider {
  return {
    name: "forexfactory",
    enabled: true,
    async sync() {
      const events = await fetchJson<FfEvent[]>("forexfactory", FEED_URL);
      if (!Array.isArray(events)) return { upserted: 0 };

      let upserted = 0;
      for (const e of events) {
        if (!e.title || !e.country || !e.date) continue;
        const currency = e.country.toUpperCase();
        if (!CURRENCIES.has(currency)) continue;
        const eventTime = new Date(e.date);
        if (Number.isNaN(eventTime.getTime())) continue;
        // The feed has no stable id — derive one from the identity fields so
        // re-syncs update in place instead of duplicating.
        const externalId =
          "ff:" + createHash("sha256").update(`${e.title}|${currency}|${e.date}`).digest("hex").slice(0, 24);
        await prisma.economicEvent.upsert({
          where: { externalId },
          update: {
            impact: mapImpact(e.impact),
            previousValue: e.previous || null,
            forecastValue: e.forecast || null,
          },
          create: {
            externalId,
            name: e.title,
            currency,
            impact: mapImpact(e.impact),
            eventTime,
            previousValue: e.previous || null,
            forecastValue: e.forecast || null,
            source: "Forex Factory",
          },
        });
        upserted++;
      }
      return { upserted };
    },
  };
}
