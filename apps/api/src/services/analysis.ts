import { prisma } from "@investiq/db";
import {
  entitlementsFor,
  errors,
  withinAiQuota,
  type AnalysisOutput,
  type Plan,
} from "@investiq/shared";
import {
  runAnalysis,
  type AnalysisModel,
  type AnalysisPorts,
  type EvidenceBundle,
  type EvidenceDatum,
} from "@investiq/ai";
import { findSymbolByTicker } from "./symbols.js";
import type { MarketService } from "./market.js";
import type { NewsService } from "./news.js";
import type { FundamentalsService } from "./fundamentals.js";

const USAGE_METRIC = "ai_analysis";
const MAX_NEWS_EVIDENCE = 8;

export interface AnalysisDeps {
  market: MarketService;
  news: NewsService;
  fundamentals: FundamentalsService;
  model: AnalysisModel;
}

/** UTC first-of-month — the AI quota period. */
function currentPeriodStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Assemble the evidence bundle the AI is allowed to reason over. Each source is
 * isolated: a provider failure (or missing key) simply omits that source, which
 * the sufficiency check then accounts for — it never crashes the request.
 */
async function assembleBundle(
  deps: AnalysisDeps,
  ticker: string,
  symbolId: string,
): Promise<EvidenceBundle> {
  const T = ticker.toUpperCase();
  const data: EvidenceDatum[] = [];

  try {
    const q = await deps.market.getQuote(T);
    data.push({
      ref: `price:${T}:quote`,
      sourceType: "PRICE",
      value: { price: q.price, change: q.change, changePct: q.changePct, volume: q.volume, asOf: q.asOf },
    });
  } catch {
    /* no price datum */
  }

  try {
    // Technicals (RSI/SMA/MACD) sharpen the model's technical read — without them
    // it only sees a single price point. Best-effort; tagged PRICE for citation.
    const tech = await deps.market.getTechnicals(T);
    if (tech) {
      data.push({
        ref: `price:${T}:technicals`,
        sourceType: "PRICE",
        value: {
          rsi14: tech.rsi14,
          sma50: tech.sma50,
          sma200: tech.sma200,
          macd: tech.macd,
          macdSignal: tech.macdSignal,
          asOf: tech.asOf,
        },
      });
    }
  } catch {
    /* no technicals datum */
  }

  try {
    const articles = (await deps.news.getNews(T)).slice(0, MAX_NEWS_EVIDENCE);
    // Layer 5: enrich news evidence with any stored grounded impact
    // classifications for this symbol (best-effort — never blocks analysis).
    let impactByKey = new Map<string, { impact: string; confidence: number; rationale: string }>();
    if (articles.length > 0) {
      try {
        const impacts = await prisma.newsImpact.findMany({
          where: { symbolId, article: { dedupeKey: { in: articles.map((a) => a.dedupeKey) } } },
          select: {
            impact: true,
            confidence: true,
            rationale: true,
            article: { select: { dedupeKey: true } },
          },
        });
        impactByKey = new Map(
          impacts.map((i) => [i.article.dedupeKey, { impact: i.impact, confidence: i.confidence, rationale: i.rationale }]),
        );
      } catch {
        /* impact enrichment is best-effort */
      }
    }
    for (const a of articles) {
      const cls = impactByKey.get(a.dedupeKey);
      data.push({
        ref: `news:${a.dedupeKey}`,
        sourceType: "NEWS",
        value: {
          headline: a.headline,
          summary: a.summary,
          source: a.source,
          publishedAt: a.publishedAt,
          ...(cls
            ? { impact: cls.impact, impactConfidence: cls.confidence, impactRationale: cls.rationale }
            : {}),
        },
      });
    }
  } catch {
    /* no news data */
  }

  try {
    const f = await deps.fundamentals.getFundamentals(T);
    if (f) {
      data.push({
        ref: `fund:${T}:profile`,
        sourceType: "FUNDAMENTAL",
        value: {
          marketCap: f.marketCap,
          beta: f.beta,
          pe: f.pe,
          eps: f.eps,
          sector: f.sector,
          industry: f.industry,
          ps: f.ps,
          pb: f.pb,
          roe: f.roe,
          debtToEquity: f.debtToEquity,
          netMargin: f.netMargin,
        },
      });
      // Analyst price target + rating consensus is its own evidence category, so
      // the model can weigh "what analysts think" distinctly. Only when present.
      if (f.priceTargetAvg != null || f.analystConsensus) {
        data.push({
          ref: `analyst:${T}:consensus`,
          sourceType: "ANALYST",
          value: { priceTargetAvg: f.priceTargetAvg, consensus: f.analystConsensus, asOf: f.asOf },
        });
      }
    }
  } catch {
    /* no fundamentals datum */
  }

  return { ticker: T, data };
}

type StoredAnalysis = Awaited<ReturnType<typeof loadAnalysisById>>;

function loadAnalysisById(id: string) {
  return prisma.analysis.findUniqueOrThrow({ where: { id }, include: { evidence: true } });
}

/**
 * Build the Prisma `create` payload for a validated analysis (+ its evidence
 * snapshot). Centralized so the per-user and global (userId=null, market-scan)
 * paths persist identically — only the owner differs.
 */
function analysisCreateData(
  userId: string | null,
  symbolId: string,
  args: { output: AnalysisOutput; bundle: EvidenceBundle; inputsHash: string; model: string },
) {
  const { output, bundle, inputsHash, model } = args;
  const valueByRef = new Map(bundle.data.map((d) => [d.ref, d.value]));
  return {
    userId,
    symbolId,
    recommendationType: output.recommendationType,
    summary: output.summary,
    bullCase: output.bullCase,
    bearCase: output.bearCase,
    keyRisks: output.keyRisks,
    newsImpactSummary: output.newsImpactSummary,
    technicalSummary: output.technicalSummary,
    confidenceScore: output.confidenceScore,
    riskScore: output.riskScore,
    model,
    inputsHash,
    evidence: {
      create: output.evidence.map((e) => ({
        sourceType: e.sourceType,
        reference: e.reference,
        role: e.role,
        // Snapshot the cited value at generation time + the model's note.
        snapshot: { note: e.note, value: valueByRef.get(e.reference) ?? null },
      })),
    },
  };
}

/**
 * Generate (or reuse) an AI analysis for a symbol on behalf of a user.
 * Delegates the decision flow to the grounded pipeline; this module supplies the
 * prisma-backed ports (cache lookup, quota check, persistence + usage increment).
 */
export async function generateAnalysis(
  userId: string,
  plan: Plan,
  ticker: string,
  deps: AnalysisDeps,
) {
  const symbol = await findSymbolByTicker(ticker);
  if (!symbol) throw errors.notFound(`Unknown or unsupported symbol: ${ticker}`);

  const bundle = await assembleBundle(deps, ticker, symbol.id);
  const periodStart = currentPeriodStart();

  const ports: AnalysisPorts<StoredAnalysis> = {
    async loadCached(inputsHash) {
      return prisma.analysis.findUnique({
        where: { userId_symbolId_inputsHash: { userId, symbolId: symbol.id, inputsHash } },
        include: { evidence: true },
      });
    },
    async quotaOk() {
      const counter = await prisma.usageCounter.findUnique({
        where: { userId_metric_periodStart: { userId, metric: USAGE_METRIC, periodStart } },
        select: { count: true },
      });
      return withinAiQuota(plan, counter?.count ?? 0);
    },
    async persist(args) {
      try {
        return await prisma.$transaction(async (tx) => {
          const created = await tx.analysis.create({
            data: analysisCreateData(userId, symbol.id, args),
            include: { evidence: true },
          });
          await tx.usageCounter.upsert({
            where: { userId_metric_periodStart: { userId, metric: USAGE_METRIC, periodStart } },
            update: { count: { increment: 1 } },
            create: { userId, metric: USAGE_METRIC, periodStart, count: 1 },
          });
          return created;
        });
      } catch (e) {
        // Concurrent duplicate (same inputs hash) — return the row the other
        // request created; do not double-count usage.
        if ((e as { code?: string }).code === "P2002") {
          return prisma.analysis.findUniqueOrThrow({
            where: {
              userId_symbolId_inputsHash: { userId, symbolId: symbol.id, inputsHash: args.inputsHash },
            },
            include: { evidence: true },
          });
        }
        throw e;
      }
    },
  };

  const result = await runAnalysis(bundle, deps.model, ports);

  switch (result.status) {
    case "insufficient":
      return { status: "insufficient" as const, message: result.message, missing: result.missing };
    case "quota_exceeded":
      throw errors.quota(
        `You've used all ${entitlementsFor(plan).aiAnalysesPerPeriod} AI analyses for this period. Upgrade for more.`,
      );
    case "invalid_output":
      // The model produced ungrounded/forbidden/invalid output — discard, do not store.
      throw errors.upstream("The analysis could not be generated reliably. Please try again.");
    case "cached":
      return { status: "cached" as const, analysis: result.analysis };
    case "created":
      return { status: "created" as const, analysis: result.analysis };
  }
}

/**
 * Generate (or reuse) a GLOBAL, non-personalized analysis for a symbol
 * (`userId = null`). Used by the daily market scan so the AI can surface
 * "Watch" candidates across the universe without being tied to any one user:
 *  - no AI quota (it's a system job, not a user action), and
 *  - cached globally per (symbolId, inputsHash) so an unchanged universe is
 *    free to re-scan.
 * The output is identical educational "Watch" framing — never personalized
 * advice. Returns the same AnalysisResult union as generateAnalysis.
 */
export async function generateGlobalAnalysis(ticker: string, deps: AnalysisDeps) {
  const symbol = await findSymbolByTicker(ticker);
  if (!symbol) throw errors.notFound(`Unknown or unsupported symbol: ${ticker}`);

  const bundle = await assembleBundle(deps, ticker, symbol.id);

  const ports: AnalysisPorts<StoredAnalysis> = {
    async loadCached(inputsHash) {
      // No composite unique on null userId, so match the latest global row.
      return prisma.analysis.findFirst({
        where: { userId: null, symbolId: symbol.id, inputsHash },
        orderBy: { generatedAt: "desc" },
        include: { evidence: true },
      });
    },
    // System job: never gated by a per-user quota.
    async quotaOk() {
      return true;
    },
    async persist(args) {
      return prisma.analysis.create({
        data: analysisCreateData(null, symbol.id, args),
        include: { evidence: true },
      });
    },
  };

  return runAnalysis(bundle, deps.model, ports);
}

/** Latest stored analysis for this user + symbol, or null. */
export async function getLatestAnalysis(userId: string, ticker: string) {
  const symbol = await findSymbolByTicker(ticker);
  if (!symbol) throw errors.notFound(`Unknown or unsupported symbol: ${ticker}`);
  return prisma.analysis.findFirst({
    where: { userId, symbolId: symbol.id },
    orderBy: { generatedAt: "desc" },
    include: { evidence: true },
  });
}
