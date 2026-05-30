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
}

export interface NewsServiceOptions {
  benzingaKey: string;
  marketauxKey: string;
}

/**
 * News service. Pulls from Benzinga + MarketAux in parallel, merges + dedupes,
 * and caches per-symbol windows (non-personalized). Tolerates one provider
 * failing so the feed still renders.
 */
export function createNewsService(opts: NewsServiceOptions): NewsService {
  const providers: NewsProvider[] = [
    new BenzingaProvider(opts.benzingaKey),
    new MarketauxProvider(opts.marketauxKey),
  ];
  const cache = new InMemoryTtlCache();

  async function getNews(ticker?: string): Promise<NormalizedArticle[]> {
    const key = `news:${ticker?.toUpperCase() ?? "ALL"}`;
    return cache.wrap(key, NEWS_TTL_MS, async () => {
      const settled = await Promise.allSettled(providers.map((p) => p.getNews(ticker)));
      const lists = settled
        .filter((r): r is PromiseFulfilledResult<NormalizedArticle[]> => r.status === "fulfilled")
        .map((r) => r.value);
      return mergeNews(...lists);
    });
  }

  return { getNews };
}
