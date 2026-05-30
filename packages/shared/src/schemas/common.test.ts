import { describe, it, expect } from "vitest";
import {
  addWatchlistItemSchema,
  createWatchlistSchema,
  symbolSearchSchema,
  tickerSchema,
} from "./common.js";

describe("request schemas", () => {
  it("createWatchlistSchema rejects unknown fields", () => {
    expect(createWatchlistSchema.safeParse({ name: "Tech", isAdmin: true }).success).toBe(false);
    expect(createWatchlistSchema.safeParse({ name: "Tech" }).success).toBe(true);
  });

  it("createWatchlistSchema rejects empty/oversized names", () => {
    expect(createWatchlistSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createWatchlistSchema.safeParse({ name: "x".repeat(61) }).success).toBe(false);
  });

  it("tickerSchema normalizes case and rejects junk", () => {
    expect(tickerSchema.parse("aapl")).toBe("AAPL");
    expect(tickerSchema.safeParse("not a ticker!").success).toBe(false);
    expect(tickerSchema.safeParse("").success).toBe(false);
  });

  it("addWatchlistItemSchema requires a valid ticker and rejects unknown fields", () => {
    expect(addWatchlistItemSchema.safeParse({ ticker: "msft" }).success).toBe(true);
    expect(addWatchlistItemSchema.safeParse({ ticker: "MSFT", symbolId: "x" }).success).toBe(false);
    expect(addWatchlistItemSchema.safeParse({ ticker: "" }).success).toBe(false);
  });

  it("symbolSearchSchema requires a non-empty query and rejects extras", () => {
    expect(symbolSearchSchema.safeParse({ q: "apple" }).success).toBe(true);
    expect(symbolSearchSchema.safeParse({ q: "" }).success).toBe(false);
    expect(symbolSearchSchema.safeParse({ q: "apple", limit: 5 }).success).toBe(false);
  });
});
