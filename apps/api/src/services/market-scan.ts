import { prisma } from "@investiq/db";
import {
  buildOpportunities,
  type NewsTone,
  type OpportunityGroup,
  type OpportunityInput,
  type RecommendationType,
} from "@investiq/shared";
import { InMemoryTtlCache } from "@investiq/integrations";
import { generateGlobalAnalysis, type AnalysisDeps } from "./analysis.js";
import { supportingNote } from "./opportunities.js";

/**
 * Market Scan — the AI-driven, NON-personalized opportunity engine.
 *
 * A scheduled job (daily, via /api/v1/cron/scan-market) runs the same grounded
 * analysis pipeline over the curated symbol universe and stores GLOBAL analyses
 * (`userId = null`). Those are categorized with the shared Opportunity engine
 * into "Market watches" shown to every user — even ones who haven't analyzed
 * anything themselves.
 *
 * Compliance (Path A): these are general, educational "Watch" candidates derived
 * from real evidence and identical for everyone. They are NOT personalized advice
 * and never buy/sell directives (the AI validator enforces the framing).
 */

const MARKET_OPPS_TTL_MS = 60 * 60 * 1000; // 1h — refreshed at the end of each scan
const SCAN_DELAY_MS = 1500; // throttle between symbols to respect provider rate limits

const cache = new InMemoryTtlCache();
const MARKET_OPPS_KEY = "market-opportunities";
let scanning = false; // single-flight guard so overlapping triggers don't double-run

export interface MarketScanResult {
  scanned: number;
  created: number;
  cached: number;
  skipped: number; // insufficient evidence / invalid output / quota
  failed: number; // threw (e.g. provider/network)
}

/** Categorize the stored GLOBAL analyses into ranked, non-personalized groups. */
async function computeMarketOpportunities(): Promise<OpportunityGroup[]> {
  const analyses = await prisma.analysis.findMany({
    where: { userId: null },
    distinct: ["symbolId"],
    orderBy: [{ symbolId: "asc" }, { generatedAt: "desc" }],
    select: {
      symbolId: true,
      recommendationType: true,
      confidenceScore: true,
      riskScore: true,
      symbol: { select: { ticker: true, name: true, assetType: true } },
      evidence: { select: { role: true, snapshot: true } },
    },
  });
  if (analyses.length === 0) return [];

  const symbolIds = analyses.map((a) => a.symbolId);
  // Latest grounded news tone per symbol (global classification, not per-user).
  const newsRows = await prisma.newsImpact.findMany({
    where: { symbolId: { in: symbolIds } },
    orderBy: { generatedAt: "desc" },
    select: { symbolId: true, impact: true },
  });
  const toneBySymbol = new Map<string, NewsTone>();
  for (const n of newsRows) if (!toneBySymbol.has(n.symbolId)) toneBySymbol.set(n.symbolId, n.impact as NewsTone);

  const inputs = analyses.map<OpportunityInput>((a) => ({
    ticker: a.symbol.ticker,
    name: a.symbol.name,
    assetType: a.symbol.assetType as "STOCK" | "ETF",
    recommendationType: a.recommendationType as RecommendationType,
    confidenceScore: a.confidenceScore,
    riskScore: a.riskScore,
    held: false, // global scan — never personalized
    warningColor: null, // no per-user risk context in the global scan
    newsTone: toneBySymbol.get(a.symbolId) ?? null,
    evidenceNote: supportingNote(a.evidence),
  }));
  return buildOpportunities(inputs);
}

/** Cached read of the market watch-list. Cheap; safe to call per request. */
export async function getMarketOpportunities(): Promise<OpportunityGroup[]> {
  const cached = cache.get<OpportunityGroup[]>(MARKET_OPPS_KEY);
  if (cached) return cached;
  const groups = await computeMarketOpportunities();
  cache.set(MARKET_OPPS_KEY, groups, MARKET_OPPS_TTL_MS);
  return groups;
}

/**
 * Scan the curated universe: generate a global analysis per active symbol,
 * sequentially (throttled), best-effort. Single-flight — a second call while a
 * scan is running is a no-op. Refreshes the market-opportunities cache at the end.
 */
export async function scanMarket(
  deps: AnalysisDeps,
  log?: (msg: string, err?: unknown) => void,
): Promise<MarketScanResult> {
  const empty: MarketScanResult = { scanned: 0, created: 0, cached: 0, skipped: 0, failed: 0 };
  if (scanning) {
    log?.("[market-scan] already running — skipped");
    return empty;
  }
  scanning = true;
  const result: MarketScanResult = { ...empty };
  try {
    const symbols = await prisma.symbol.findMany({
      where: { active: true },
      select: { ticker: true },
      orderBy: { ticker: "asc" },
    });
    log?.(`[market-scan] starting — ${symbols.length} symbols`);

    for (const s of symbols) {
      result.scanned++;
      try {
        const r = await generateGlobalAnalysis(s.ticker, deps);
        if (r.status === "created") result.created++;
        else if (r.status === "cached") result.cached++;
        else result.skipped++; // insufficient | invalid_output | quota_exceeded
      } catch (e) {
        result.failed++;
        log?.(`[market-scan] failed for ${s.ticker}`, e);
      }
      await new Promise((res) => setTimeout(res, SCAN_DELAY_MS));
    }

    // Recompute + warm the cache so the next read is instant and current.
    cache.set(MARKET_OPPS_KEY, await computeMarketOpportunities(), MARKET_OPPS_TTL_MS);
    log?.(`[market-scan] done — ${JSON.stringify(result)}`);
    return result;
  } finally {
    scanning = false;
  }
}
