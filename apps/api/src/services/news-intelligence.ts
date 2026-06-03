import { prisma, Prisma, type NewsImpactType } from "@investiq/db";
import { errors, type Plan } from "@investiq/shared";
import {
  classifyNewsArticle,
  type NewsArticleInput,
  type NewsClassifierModel,
} from "@investiq/ai";
import type { NormalizedArticle } from "@investiq/integrations";
import { requireEntitlement } from "../lib/auth.js";
import { findSymbolByTicker } from "./symbols.js";
import type { NewsService } from "./news.js";

const FEATURE_LABEL = "News Intelligence";
const MAX_INGEST = 12;
const MAX_RETURN = 30;

export interface NewsIntelligenceDeps {
  news: NewsService;
  classifier: NewsClassifierModel;
}

/** Upsert the article (dedupe by dedupeKey) and link it to the symbol. Idempotent. */
async function upsertArticleAndLink(a: NormalizedArticle, symbolId: string): Promise<string> {
  const article = await prisma.newsArticle.upsert({
    where: { dedupeKey: a.dedupeKey },
    create: {
      source: a.source,
      url: a.url,
      headline: a.headline,
      summary: a.summary,
      publishedAt: new Date(a.publishedAt),
      dedupeKey: a.dedupeKey,
    },
    update: {},
    select: { id: true },
  });
  await prisma.newsSymbolLink.upsert({
    where: { articleId_symbolId: { articleId: article.id, symbolId } },
    create: { articleId: article.id, symbolId },
    update: {},
  });
  return article.id;
}

export interface IngestSummary {
  status: "ok";
  ticker: string;
  fetched: number;
  classified: number;
  existing: number;
  skipped: number;
}

/**
 * Ingest the latest news for a ticker, persist + dedupe articles, and classify
 * each new (article, symbol) pair's impact (grounded AI). Investor+ gated.
 * Idempotent: existing articles (dedupeKey) and existing impacts
 * (article+symbol unique) are skipped, so re-runs never duplicate or re-spend.
 */
export async function ingestAndClassify(
  ticker: string,
  plan: Plan,
  deps: NewsIntelligenceDeps,
): Promise<IngestSummary> {
  requireEntitlement(plan, "newsIntelligence", FEATURE_LABEL);

  const symbol = await findSymbolByTicker(ticker);
  if (!symbol) throw errors.notFound(`Unknown or unsupported symbol: ${ticker}`);
  const T = ticker.toUpperCase();

  const articles = (await deps.news.getNews(T)).slice(0, MAX_INGEST);
  let classified = 0;
  let existing = 0;
  let skipped = 0;

  for (const a of articles) {
    const articleId = await upsertArticleAndLink(a, symbol.id);

    // Dedupe classification: one NewsImpact per (article, symbol).
    const already = await prisma.newsImpact.findUnique({
      where: { articleId_symbolId: { articleId, symbolId: symbol.id } },
      select: { id: true },
    });
    if (already) {
      existing += 1;
      continue;
    }

    const input: NewsArticleInput = {
      ticker: T,
      headline: a.headline,
      summary: a.summary,
      source: a.source,
      publishedAt: a.publishedAt,
    };
    let result: Awaited<ReturnType<typeof classifyNewsArticle>>;
    try {
      result = await classifyNewsArticle(input, deps.classifier);
    } catch {
      // A transient classifier failure (rate limit / 5xx) must not abandon the
      // rest of the batch. The article + symbol link are already persisted and
      // this pair has no NewsImpact yet, so a later run retries it.
      skipped += 1;
      continue;
    }
    if (result.status !== "classified") {
      skipped += 1;
      continue;
    }

    try {
      await prisma.newsImpact.create({
        data: {
          articleId,
          symbolId: symbol.id,
          impact: result.output.impact as NewsImpactType,
          rationale: result.output.rationale,
          confidence: result.output.confidence,
        },
      });
      classified += 1;
    } catch (e) {
      // Lost a race — another run classified the same pair first.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") existing += 1;
      else throw e;
    }
  }

  return { status: "ok", ticker: T, fetched: articles.length, classified, existing, skipped };
}

export interface ArticleWithImpact {
  id: string;
  source: string;
  url: string;
  headline: string;
  summary: string | null;
  publishedAt: Date;
  impact: { impact: string; rationale: string; confidence: number; generatedAt: Date } | null;
}

/** Stored articles for a symbol, newest first, each with its impact (or null). Investor+ gated. */
export async function getSymbolNewsWithImpact(
  ticker: string,
  plan: Plan,
): Promise<ArticleWithImpact[]> {
  requireEntitlement(plan, "newsIntelligence", FEATURE_LABEL);

  const symbol = await findSymbolByTicker(ticker);
  if (!symbol) throw errors.notFound(`Unknown or unsupported symbol: ${ticker}`);

  const articles = await prisma.newsArticle.findMany({
    where: { symbolLinks: { some: { symbolId: symbol.id } } },
    orderBy: { publishedAt: "desc" },
    take: MAX_RETURN,
    select: {
      id: true,
      source: true,
      url: true,
      headline: true,
      summary: true,
      publishedAt: true,
      impacts: {
        where: { symbolId: symbol.id },
        select: { impact: true, rationale: true, confidence: true, generatedAt: true },
      },
    },
  });

  return articles.map((a) => ({
    id: a.id,
    source: a.source,
    url: a.url,
    headline: a.headline,
    summary: a.summary,
    publishedAt: a.publishedAt,
    impact: a.impacts[0] ?? null,
  }));
}
