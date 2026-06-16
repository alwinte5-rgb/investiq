import { describe, it, expect } from "vitest";
import { groupSymbols, type DiscoverySymbol } from "./discovery.js";

const sym = (
  ticker: string,
  sector: string | null,
  assetType: "STOCK" | "ETF" = "STOCK",
): DiscoverySymbol => ({ ticker, name: `${ticker} Inc.`, sector, assetType });

describe("groupSymbols (discovery)", () => {
  it("buckets stocks into friendly sector groups in a fixed order, ETFs last", () => {
    const groups = groupSymbols([
      sym("AAPL", "Technology"),
      sym("EA", "Gaming & Entertainment"),
      sym("JPM", "Financials"),
      sym("SPY", "Broad Market", "ETF"),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["tech", "gaming", "finance", "etfs"]);
    expect(groups[0]?.items.map((i) => i.ticker)).toEqual(["AAPL"]);
    expect(groups.at(-1)?.key).toBe("etfs");
  });

  it("drops empty sector groups (a SECTOR_META entry with no tickers never appears)", () => {
    const groups = groupSymbols([sym("AAPL", "Technology")]);
    // Only the populated group is present — no blank "Gaming", "Energy", etc.
    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe("tech");
  });

  it("routes unrecognized sectors (and null) into 'Other', not a sector bucket", () => {
    const groups = groupSymbols([
      sym("AAPL", "Technology"),
      sym("ZZZZ", "Made Up Sector"),
      sym("NULLCO", null),
    ]);
    const other = groups.find((g) => g.key === "other");
    expect(other).toBeDefined();
    expect(other?.items.map((i) => i.ticker).sort()).toEqual(["NULLCO", "ZZZZ"]);
  });

  it("classifies asset type and never fabricates price/market cap", () => {
    const [stockGroup] = groupSymbols([sym("AAPL", "Technology")]);
    const item = stockGroup?.items[0];
    expect(item?.assetType).toBe("STOCK");
    expect(item?.price).toBeNull();
    expect(item?.marketCap).toBeNull();
    expect(item?.beta).toBeNull();

    const [etfGroup] = groupSymbols([sym("VOO", "Broad Market", "ETF")]);
    expect(etfGroup?.items[0]?.assetType).toBe("ETF");
  });

  it("returns no groups for an empty universe", () => {
    expect(groupSymbols([])).toEqual([]);
  });
});
