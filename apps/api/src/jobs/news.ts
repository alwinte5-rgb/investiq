import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { prisma } from "@investiq/db";
import { loadServerEnv } from "@investiq/shared";
import { createAnthropicNewsClassifier } from "@investiq/ai";
import { createNewsService } from "../services/news.js";
import { ingestAndClassify, type NewsIntelligenceDeps } from "../services/news-intelligence.js";

/**
 * Scheduled news-intelligence job (Layer 5). Ingests + classifies news for the
 * monitored universe (every symbol that is watchlisted or held). Idempotent:
 * dedupe on article + (article,symbol) impact means re-runs never duplicate or
 * re-spend. Invoke from a Railway cron, e.g. hourly:
 *   npm run -w @investiq/api job:news
 */

function loadDevEnv() {
  if (process.env.NODE_ENV === "production") return;
  const loadEnvFile = (process as { loadEnvFile?: (path: string) => void }).loadEnvFile;
  if (!loadEnvFile) return;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    loadEnvFile.call(process, resolve(here, "../../../../.env"));
  } catch {
    /* rely on ambient env */
  }
}

async function main() {
  loadDevEnv();
  const env = loadServerEnv();

  const news = createNewsService({ benzingaKey: env.BENZINGA_API_KEY, marketauxKey: env.MARKETAUX_API_KEY });
  if (!env.ANTHROPIC_API_KEY || !news.enabled) {
    console.log(
      `[news] disabled — anthropic=${Boolean(env.ANTHROPIC_API_KEY)} news=${news.enabled}. Nothing to do.`,
    );
    await prisma.$disconnect();
    return;
  }
  const deps: NewsIntelligenceDeps = {
    news,
    classifier: createAnthropicNewsClassifier({ apiKey: env.ANTHROPIC_API_KEY, model: env.AI_MODEL }),
  };

  // Monitored universe: symbols that appear in a watchlist or a holding.
  const symbols = await prisma.symbol.findMany({
    where: { active: true, OR: [{ watchlistItems: { some: {} } }, { holdings: { some: {} } }] },
    select: { ticker: true },
    orderBy: { ticker: "asc" },
  });

  const stats = { symbols: symbols.length, fetched: 0, classified: 0, existing: 0, skipped: 0, failed: 0 };
  console.log(`[news] monitoring ${symbols.length} symbols`);

  for (const s of symbols) {
    try {
      const r = await ingestAndClassify(s.ticker, "INVESTOR_PLUS", deps);
      stats.fetched += r.fetched;
      stats.classified += r.classified;
      stats.existing += r.existing;
      stats.skipped += r.skipped;
    } catch (err) {
      stats.failed += 1;
      console.error(`[news] ${s.ticker} error:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[news] done`, JSON.stringify(stats));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[news] fatal:", err instanceof Error ? err.message : err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
