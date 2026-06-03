/**
 * Demo ("sample data") portfolio.
 *
 * A fixed, realistic US stock/ETF portfolio used to let people explore InvestIQ
 * — Research, Portfolio Intelligence, Reviews, News — before connecting a real
 * brokerage. Defined here as PURE data (no I/O) so it is reproducible and unit
 * testable: `demoPortfolioInput()` feeds the same `scorePortfolio` used for real
 * holdings, and a test asserts it scores cleanly (not "insufficient").
 *
 * It is intentionally tech-tilted (AAPL+MSFT+NVDA) so Portfolio Intelligence and
 * the AI reviews surface genuine flags (sector concentration) rather than a flat,
 * uninteresting result.
 */

import type { HoldingInput, PortfolioInput } from "./portfolio.js";

export interface DemoHolding {
  ticker: string;
  name: string;
  assetType: "STOCK" | "ETF";
  sector: string | null;
  quantity: number;
  avgCost: number;
  marketValue: number;
}

/** Uninvested cash in the sample account. */
export const DEMO_CASH = 6000;

/** The sample positions. marketValue figures are the source of truth for scoring. */
export const DEMO_HOLDINGS: DemoHolding[] = [
  { ticker: "AAPL", name: "Apple Inc.", assetType: "STOCK", sector: "Technology", quantity: 110, avgCost: 150, marketValue: 22000 },
  { ticker: "MSFT", name: "Microsoft Corporation", assetType: "STOCK", sector: "Technology", quantity: 38, avgCost: 320, marketValue: 16000 },
  { ticker: "NVDA", name: "NVIDIA Corporation", assetType: "STOCK", sector: "Technology", quantity: 100, avgCost: 90, marketValue: 12000 },
  { ticker: "AMZN", name: "Amazon.com, Inc.", assetType: "STOCK", sector: "Consumer Discretionary", quantity: 55, avgCost: 140, marketValue: 10000 },
  { ticker: "JPM", name: "JPMorgan Chase & Co.", assetType: "STOCK", sector: "Financials", quantity: 40, avgCost: 175, marketValue: 9000 },
  { ticker: "JNJ", name: "Johnson & Johnson", assetType: "STOCK", sector: "Health Care", quantity: 50, avgCost: 160, marketValue: 8000 },
  { ticker: "XOM", name: "Exxon Mobil Corporation", assetType: "STOCK", sector: "Energy", quantity: 60, avgCost: 105, marketValue: 7000 },
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", assetType: "ETF", sector: null, quantity: 28, avgCost: 400, marketValue: 14000 },
];

/** Total account value = invested + cash. */
export const DEMO_TOTAL_VALUE =
  DEMO_HOLDINGS.reduce((acc, h) => acc + h.marketValue, 0) + DEMO_CASH;

/** The sample portfolio shaped for `scorePortfolio` (pure — no DB needed). */
export function demoPortfolioInput(): PortfolioInput {
  const holdings: HoldingInput[] = DEMO_HOLDINGS.map((h) => ({
    ticker: h.ticker,
    assetType: h.assetType,
    sector: h.sector,
    marketValue: h.marketValue,
  }));
  return { holdings, cash: DEMO_CASH };
}
