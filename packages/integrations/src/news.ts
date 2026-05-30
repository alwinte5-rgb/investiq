import { fetchJson } from "./http.js";

export interface NormalizedArticle {
  source: string; // benzinga | marketaux
  url: string;
  headline: string;
  summary: string | null;
  publishedAt: string; // ISO
  tickers: string[];
  dedupeKey: string;
}

export interface NewsProvider {
  readonly name: string;
  getNews(ticker?: string): Promise<NormalizedArticle[]>;
}

/** Stable dedupe key: normalized URL if present, else headline+timestamp. */
export function dedupeKeyFor(url: string | undefined, headline: string, publishedAt: string): string {
  if (url) {
    return url.trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/$/, "");
  }
  return `${headline.trim().toLowerCase()}|${publishedAt}`;
}

/** Merge multiple provider results, dedupe by key, sort newest-first. */
export function mergeNews(...lists: NormalizedArticle[][]): NormalizedArticle[] {
  const byKey = new Map<string, NormalizedArticle>();
  for (const list of lists) {
    for (const a of list) {
      if (!byKey.has(a.dedupeKey)) byKey.set(a.dedupeKey, a);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

// ---------- Benzinga ----------
export interface BenzingaItem {
  id?: number;
  created?: string;
  title?: string;
  url?: string;
  teaser?: string;
  stocks?: Array<{ name?: string }>;
}

export function parseBenzinga(items: BenzingaItem[]): NormalizedArticle[] {
  return (items ?? [])
    .filter((i) => i.title && i.created)
    .map((i) => {
      const publishedAt = new Date(i.created as string).toISOString();
      return {
        source: "benzinga",
        url: i.url ?? "",
        headline: i.title as string,
        summary: i.teaser ?? null,
        publishedAt,
        tickers: (i.stocks ?? []).map((s) => s.name).filter((n): n is string => !!n),
        dedupeKey: dedupeKeyFor(i.url, i.title as string, publishedAt),
      };
    });
}

export class BenzingaProvider implements NewsProvider {
  readonly name = "benzinga";
  constructor(private readonly apiKey: string) {}

  async getNews(ticker?: string): Promise<NormalizedArticle[]> {
    const params = new URLSearchParams({ token: this.apiKey, pageSize: "25", displayOutput: "full" });
    if (ticker) params.set("tickers", ticker.toUpperCase());
    const url = `https://api.benzinga.com/api/v2/news?${params.toString()}`;
    const json = await fetchJson<BenzingaItem[]>("benzinga", url, {
      headers: { accept: "application/json" },
    });
    return parseBenzinga(json);
  }
}

// ---------- MarketAux ----------
export interface MarketauxResponse {
  data?: Array<{
    uuid?: string;
    title?: string;
    description?: string;
    url?: string;
    published_at?: string;
    entities?: Array<{ symbol?: string }>;
  }>;
}

export function parseMarketaux(json: MarketauxResponse): NormalizedArticle[] {
  return (json.data ?? [])
    .filter((i) => i.title && i.published_at)
    .map((i) => {
      const publishedAt = new Date(i.published_at as string).toISOString();
      return {
        source: "marketaux",
        url: i.url ?? "",
        headline: i.title as string,
        summary: i.description ?? null,
        publishedAt,
        tickers: (i.entities ?? []).map((e) => e.symbol).filter((s): s is string => !!s),
        dedupeKey: dedupeKeyFor(i.url, i.title as string, publishedAt),
      };
    });
}

export class MarketauxProvider implements NewsProvider {
  readonly name = "marketaux";
  constructor(private readonly apiKey: string) {}

  async getNews(ticker?: string): Promise<NormalizedArticle[]> {
    const params = new URLSearchParams({
      api_token: this.apiKey,
      language: "en",
      filter_entities: "true",
      limit: "25",
    });
    if (ticker) params.set("symbols", ticker.toUpperCase());
    const url = `https://api.marketaux.com/v1/news/all?${params.toString()}`;
    const json = await fetchJson<MarketauxResponse>("marketaux", url);
    return parseMarketaux(json);
  }
}
