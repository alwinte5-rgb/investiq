import { describe, it, expect } from "vitest";
import {
  FailoverMarketData,
  parseMassiveSnapshot,
  parseTwelveDataQuote,
  type MarketDataProvider,
  type NormalizedQuote,
} from "./market-data.js";
import { InMemoryTtlCache } from "./cache.js";
import { dedupeKeyFor, mergeNews, parseBenzinga, parseMarketaux } from "./news.js";

describe("market-data parsers", () => {
  it("parseMassiveSnapshot prefers last trade price", () => {
    const q = parseMassiveSnapshot(
      {
        ticker: {
          todaysChange: 1.2,
          todaysChangePerc: 0.5,
          day: { c: 189, v: 1000 },
          lastTrade: { p: 190.1 },
        },
      },
      "aapl",
    );
    expect(q).toMatchObject({ ticker: "AAPL", price: 190.1, change: 1.2, source: "massive" });
  });

  it("parseMassiveSnapshot throws when no price", () => {
    expect(() => parseMassiveSnapshot({ ticker: {} }, "AAPL")).toThrow();
  });

  it("parseTwelveDataQuote coerces strings and handles error status", () => {
    const q = parseTwelveDataQuote(
      { close: "190.10", change: "1.2", percent_change: "0.5", volume: "1000" },
      "AAPL",
    );
    expect(q.price).toBe(190.1);
    expect(q.changePct).toBe(0.5);
    expect(() => parseTwelveDataQuote({ status: "error", message: "bad key" }, "AAPL")).toThrow();
  });
});

describe("FailoverMarketData", () => {
  const good = (source: string): MarketDataProvider => ({
    name: source,
    async getQuote(t): Promise<NormalizedQuote> {
      return { ticker: t, price: 1, change: null, changePct: null, volume: null, asOf: "", source };
    },
  });
  const bad: MarketDataProvider = {
    name: "primary",
    async getQuote() {
      throw new Error("down");
    },
  };

  it("uses primary when it succeeds", async () => {
    const f = new FailoverMarketData(good("polygon"), good("twelvedata"));
    expect((await f.getQuote("AAPL")).source).toBe("polygon");
  });

  it("falls back and reports failover when primary throws", async () => {
    let reported = false;
    const f = new FailoverMarketData(bad, good("twelvedata"), () => (reported = true));
    expect((await f.getQuote("AAPL")).source).toBe("twelvedata");
    expect(reported).toBe(true);
  });
});

describe("InMemoryTtlCache", () => {
  it("returns value before expiry and undefined after", () => {
    let now = 1000;
    const cache = new InMemoryTtlCache(() => now);
    cache.set("k", 42, 500);
    expect(cache.get<number>("k")).toBe(42);
    now = 1600; // past expiry
    expect(cache.get<number>("k")).toBeUndefined();
  });

  it("wrap computes once within TTL", async () => {
    let now = 0;
    let calls = 0;
    const cache = new InMemoryTtlCache(() => now);
    const compute = async () => {
      calls++;
      return "v";
    };
    expect(await cache.wrap("k", 100, compute)).toBe("v");
    expect(await cache.wrap("k", 100, compute)).toBe("v");
    expect(calls).toBe(1);
    now = 200;
    await cache.wrap("k", 100, compute);
    expect(calls).toBe(2);
  });
});

describe("news parsing + merge", () => {
  it("parseBenzinga normalizes items and tickers", () => {
    const out = parseBenzinga([
      { id: 1, created: "2026-05-30T10:00:00Z", title: "Deal", url: "https://x.com/a", teaser: "t", stocks: [{ name: "AAPL" }] },
      { id: 2, created: "", title: "" }, // dropped (no title/date)
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ source: "benzinga", tickers: ["AAPL"] });
  });

  it("parseMarketaux normalizes entities", () => {
    const out = parseMarketaux({
      data: [
        { uuid: "u", title: "News", url: "https://y.com/b", published_at: "2026-05-30T09:00:00Z", entities: [{ symbol: "MSFT" }] },
      ],
    });
    expect(out[0]).toMatchObject({ source: "marketaux", tickers: ["MSFT"] });
  });

  it("mergeNews dedupes by key and sorts newest first", () => {
    const a = parseBenzinga([
      { id: 1, created: "2026-05-30T08:00:00Z", title: "Old", url: "https://x.com/old" },
      { id: 2, created: "2026-05-30T12:00:00Z", title: "New", url: "https://x.com/new" },
    ]);
    const b = parseMarketaux({
      data: [{ title: "Dup", url: "https://x.com/new/", published_at: "2026-05-30T12:00:00Z" }],
    });
    const merged = mergeNews(a, b);
    expect(merged).toHaveLength(2); // /new and /new/ dedupe to one
    expect(merged[0]!.headline).toBe("New");
  });

  it("dedupeKeyFor normalizes trailing slash and query", () => {
    expect(dedupeKeyFor("https://x.com/a/?utm=1", "h", "t")).toBe("https://x.com/a");
  });
});
