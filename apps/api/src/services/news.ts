import {
  BenzingaProvider,
  InMemoryTtlCache,
  MarketauxProvider,
  mergeNews,
  type NewsProvider,
  type NormalizedArticle,
} from "@investiq/integrations";

const NEWS_TTL_MS = 60_000;

export interface NewsService {
  getNews(ticker?: string): Promise<NormalizedArticle[]>;
  /** True when at least one news provider key is configured. */
  readonly enabled: boolean;
}

export interface NewsServiceOptions {
  benzingaKey?: string;
  marketauxKey?: string;
}

/**
 * News service. Pulls from whichever of Benzinga / MarketAux have keys, in
 * parallel, then merges + dedupes and caches per-symbol windows
 * (non-personalized). A missing provider is simply skipped; one failing
 * provider doesn't blank the feed.
 */
export function createNewsService(opts: NewsServiceOptions): NewsService {
  const providers: NewsProvider[] = [];
  if (opts.benzingaKey) providers.push(new BenzingaProvider(opts.benzingaKey));
  if (opts.marketauxKey) providers.push(new MarketauxProvider(opts.marketauxKey));

  const cache = new InMemoryTtlCache();

  async function getNews(ticker?: string): Promise<NormalizedArticle[]> {
    if (providers.length === 0) return [];
    const key = `news:${ticker?.toUpperCase() ?? "ALL"}`;
    return cache.wrap(key, NEWS_TTL_MS, async () => {
      const settled = await Promise.allSettled(providers.map((p) => p.getNews(ticker)));
      const lists = settled
        .filter((r): r is PromiseFulfilledResult<NormalizedArticle[]> => r.status === "fulfilled")
        .map((r) => r.value);
      return mergeNews(...lists);
    });
  }

  return { getNews, enabled: providers.length > 0 };
}
