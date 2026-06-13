import { RECOMMENDATION_TYPES } from "./recommendations.js";

/**
 * Glossary — plain-English definitions of the financial terms InvestIQ surfaces.
 * Single source of truth (served to web + mobile via the API, never imported
 * into the clients directly). Beginner-first: every definition is one or two
 * short, jargon-free sentences and is NON-ADVISORY — it explains what a term
 * means, never what to do about it. This is the backbone of the "every screen
 * teaches" goal: any jargon a user meets can be looked up in place.
 */

export interface GlossaryTerm {
  /** Canonical display label, e.g. "P/E Ratio". */
  term: string;
  /** Lower-cased lookup keys (the term plus common synonyms/abbreviations). */
  keys: string[];
  /** One-line plain-English definition — the tooltip text. */
  short: string;
  /** Optional longer explanation shown when a user expands the term. */
  full?: string;
}

/**
 * The curated library. Keep `short` to a single sentence a beginner can read at
 * a glance; reserve nuance for `full`. Definitions must stay descriptive, never
 * directive (no "you should…").
 */
export const GLOSSARY: GlossaryTerm[] = [
  // ── Recommendation types (the 8 Watch signals) ────────────────────────────
  {
    term: "Strong Buy Watch",
    keys: ["strong buy watch", "STRONG_BUY_WATCH"],
    short: "The evidence strongly favors this stock as worth watching closely — still a signal to research, not a buy order.",
    full: "InvestIQ never tells you to buy. A Strong Buy Watch means the supporting evidence is unusually consistent, so it flags the stock for your attention. The decision — and the timing — remain yours.",
  },
  {
    term: "Buy Watch",
    keys: ["buy watch", "BUY_WATCH"],
    short: "The evidence leans positive and the stock is worth adding to your watchlist for further research.",
  },
  {
    term: "Hold",
    keys: ["hold", "HOLD"],
    short: "The evidence is balanced — nothing suggests a notable change either way right now.",
  },
  {
    term: "Trim Position",
    keys: ["trim position", "trim", "TRIM_POSITION"],
    short: "A teaching flag that the position may have grown large or risky enough to be worth reviewing — consider reducing, not selling all.",
  },
  {
    term: "Exit Consideration",
    keys: ["exit consideration", "EXIT_CONSIDERATION"],
    short: "The evidence has weakened enough that whether to keep holding is worth a careful review.",
  },
  {
    term: "High Risk Warning",
    keys: ["high risk warning", "HIGH_RISK_WARNING"],
    short: "Signals that this stock carries elevated risk (volatility, valuation, or news) and deserves extra caution.",
  },
  {
    term: "Avoid",
    keys: ["avoid", "AVOID"],
    short: "The evidence is unfavorable enough that the stock is flagged as one to steer clear of for now.",
  },
  {
    term: "Rebuy Watch",
    keys: ["rebuy watch", "REBUY_WATCH"],
    short: "A stock you previously exited that the evidence now flags as worth watching again.",
  },

  // ── Scores & the AI contract ──────────────────────────────────────────────
  {
    term: "Confidence Score",
    keys: ["confidence score", "confidence"],
    short: "0–100 rating of how strong and consistent the supporting evidence is — not a prediction of how much a stock will rise.",
    full: "High confidence means the signals agree with each other; it is never a guarantee. Low confidence means the picture is mixed and deserves extra scrutiny before you act.",
  },
  {
    term: "Risk Score",
    keys: ["risk score", "risk"],
    short: "0–100 estimate of how much a position could move against you, based on volatility, valuation, and concentration.",
    full: "A higher score is not automatically 'bad' — it is a cue to size the position smaller and watch it more closely.",
  },
  {
    term: "Evidence",
    keys: ["evidence", "evidence bundle", "supporting evidence"],
    short: "The connected, real-world data (prices, news, fundamentals) every InvestIQ analysis is built from — nothing is invented.",
    full: "If the required evidence is missing, InvestIQ returns 'Not enough data available' instead of guessing. Each analysis lists what supported it and what argued against it.",
  },

  // ── Valuation & fundamentals ──────────────────────────────────────────────
  {
    term: "P/E Ratio",
    keys: ["p/e ratio", "p/e", "pe", "pe ratio", "price to earnings"],
    short: "Price-to-earnings: the share price divided by earnings per share — roughly what you pay for each $1 of company profit.",
    full: "A high P/E can mean investors expect strong growth, or that a stock is expensive; a low P/E can mean a bargain, or trouble. It is only meaningful compared with peers and history.",
  },
  {
    term: "Market Cap",
    keys: ["market cap", "market capitalization", "marketcap"],
    short: "The total value of a company's shares: share price times the number of shares outstanding.",
    full: "It is the common way to size a company — large-cap companies are generally more established and less volatile than small-caps.",
  },
  {
    term: "EPS",
    keys: ["eps", "earnings per share"],
    short: "Earnings per share: a company's profit divided by its number of shares — the per-share slice of profit.",
  },
  {
    term: "Dividend Yield",
    keys: ["dividend yield", "dividend", "yield"],
    short: "The annual dividend a company pays, as a percentage of its share price — the cash return you get just for holding.",
  },
  {
    term: "Earnings",
    keys: ["earnings", "earnings report"],
    short: "A company's profit. Public companies report it every quarter, and the result often moves the stock sharply.",
  },
  {
    term: "Free Cash Flow",
    keys: ["free cash flow", "fcf"],
    short: "The cash a company has left after running and investing in the business — money it can use for dividends, buybacks, or growth.",
  },
  {
    term: "Beta",
    keys: ["beta"],
    short: "How much a stock tends to move relative to the overall market. Beta of 1 moves with the market; above 1 is more volatile, below 1 is calmer.",
  },

  // ── Technicals & price levels ─────────────────────────────────────────────
  {
    term: "Support",
    keys: ["support", "support level"],
    short: "A price area where a stock has tended to stop falling because buyers step in — a floor, not a guarantee.",
  },
  {
    term: "Resistance",
    keys: ["resistance", "resistance level"],
    short: "A price area where a stock has tended to stop rising because sellers step in — a ceiling, not a guarantee.",
  },
  {
    term: "RSI",
    keys: ["rsi", "relative strength index"],
    short: "Relative Strength Index (0–100) gauges momentum; very high can mean overbought, very low can mean oversold.",
  },
  {
    term: "Moving Average",
    keys: ["moving average", "ma", "sma", "ema"],
    short: "The average price over a recent window (e.g. 50 or 200 days) that smooths out daily noise to show the trend.",
  },
  {
    term: "Volume",
    keys: ["volume", "trading volume"],
    short: "How many shares traded in a period. High volume shows strong interest and makes a price move more meaningful.",
  },
  {
    term: "Volatility",
    keys: ["volatility"],
    short: "How sharply a price swings up and down. Higher volatility means bigger, faster moves in both directions.",
  },
  {
    term: "52-Week High / Low",
    keys: ["52-week high", "52-week low", "52 week high", "52 week low", "52-week high / low", "52-week range"],
    short: "The highest and lowest price a stock has traded over the past year — a quick gauge of where today's price sits.",
  },
  {
    term: "Drawdown",
    keys: ["drawdown", "max drawdown"],
    short: "The drop from a peak to the following low — how far a holding has fallen from its best point.",
  },
  {
    term: "Liquidity",
    keys: ["liquidity", "liquid"],
    short: "How easily you can buy or sell a stock without moving its price. Heavily traded stocks are more liquid.",
  },

  // ── Risk engine (buy zone, stop, target, sizing) ──────────────────────────
  {
    term: "Buy Zone",
    keys: ["buy zone", "buyzone", "entry zone"],
    short: "A price range where the risk/reward looks more favorable — not a prediction or a green light to buy.",
    full: "Entering near the lower end improves your margin of safety; chasing a stock far above the zone raises your downside.",
  },
  {
    term: "Stop Loss",
    keys: ["stop loss", "stop", "stop-loss"],
    short: "A pre-decided price at which you'd reconsider a position, capping how much one holding can hurt you.",
    full: "Deciding it before you enter removes emotion from the moment. It is a discipline tool, not a forecast.",
  },
  {
    term: "Profit Target",
    keys: ["profit target", "target", "price target"],
    short: "A price where you'd consider taking some gains — a plan set in advance, not a guarantee the stock gets there.",
  },
  {
    term: "Reward : Risk",
    keys: ["reward : risk", "reward:risk", "risk reward", "risk/reward", "r:r", "rr", "reward to risk"],
    short: "How much you stand to gain versus lose on an idea. 3:1 means the potential reward is three times the risk you're taking.",
  },
  {
    term: "Position Sizing",
    keys: ["position sizing", "position size", "suggested size", "sizing"],
    short: "How many shares to hold so that, if your stop is hit, you only lose a small, planned slice of your portfolio.",
  },
  {
    term: "Max Risk",
    keys: ["max risk", "maximum risk", "max risk amount"],
    short: "The most you'd lose on a position if its stop loss is reached — usually kept to a small percent of the whole portfolio.",
  },

  // ── Portfolio & diversification ───────────────────────────────────────────
  {
    term: "Diversification",
    keys: ["diversification", "diversified", "diversify"],
    short: "Spreading money across different stocks, sectors, and asset types so no single loss can sink your whole portfolio.",
  },
  {
    term: "Sector Concentration",
    keys: ["sector concentration", "concentration", "concentrated"],
    short: "How much of your portfolio sits in one industry. High concentration means one sector's troubles hit you harder.",
  },
  {
    term: "Overweight / Underweight",
    keys: ["overweight", "underweight", "overweight / underweight", "over/underweight"],
    short: "Holding more (overweight) or less (underweight) of something than a balanced allocation would suggest.",
  },
  {
    term: "Asset Allocation",
    keys: ["asset allocation", "allocation"],
    short: "How your money is split across types of investments (stocks, ETFs, cash) — the biggest driver of long-term results.",
  },
  {
    term: "Rebalancing",
    keys: ["rebalancing", "rebalance"],
    short: "Periodically adjusting holdings back toward your target mix after market moves have shifted them.",
  },
  {
    term: "Cost Basis",
    keys: ["cost basis", "basis"],
    short: "What you originally paid for a holding, used to measure your gain or loss.",
  },
  {
    term: "Unrealized Gain / Loss",
    keys: ["unrealized gain", "unrealized loss", "unrealized gain / loss", "unrealized", "paper gain"],
    short: "A gain or loss that exists only on paper because you still hold the position — it becomes real once you sell.",
  },

  // ── Instruments & app concepts ────────────────────────────────────────────
  {
    term: "Stock",
    keys: ["stock", "equity", "share", "shares"],
    short: "A share of ownership in a company. Its price moves with the company's prospects and overall market sentiment.",
  },
  {
    term: "ETF",
    keys: ["etf", "exchange traded fund", "exchange-traded fund"],
    short: "A basket of many stocks (or other assets) you buy in one trade — an easy way to get instant diversification.",
  },
  {
    term: "Ticker",
    keys: ["ticker", "symbol", "ticker symbol"],
    short: "The short code that identifies a stock or ETF on the exchange (e.g. AAPL for Apple).",
  },
  {
    term: "Watchlist",
    keys: ["watchlist", "watch list"],
    short: "Your saved list of stocks and ETFs to track and research — no money is committed by adding one.",
  },
  {
    term: "Paper Trading",
    keys: ["paper trading", "paper trade", "paper account", "simulated trading"],
    short: "Practicing trades with fake money so you can learn and test ideas with zero real-world risk.",
  },
  {
    term: "Bull Case",
    keys: ["bull case", "bull", "bullish"],
    short: "The argument for why a stock could do well — the optimistic side of the analysis.",
  },
  {
    term: "Bear Case",
    keys: ["bear case", "bear", "bearish"],
    short: "The argument for why a stock could struggle — the cautious side of the analysis.",
  },
  {
    term: "Brokerage",
    keys: ["brokerage", "broker", "brokerage account"],
    short: "The account or company through which you actually buy and hold investments. InvestIQ reads from it but never trades for you.",
  },
];

/** Strip a term/key down to a comparable form: lowercase, alphanumerics only. */
export function normalizeTermKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Normalized key -> term. Built once; first definition wins on any collision. */
const INDEX: Map<string, GlossaryTerm> = (() => {
  const map = new Map<string, GlossaryTerm>();
  for (const entry of GLOSSARY) {
    for (const key of [entry.term, ...entry.keys]) {
      const norm = normalizeTermKey(key);
      if (norm && !map.has(norm)) map.set(norm, entry);
    }
  }
  return map;
})();

/** Look up a term by any of its keys (or its display label). Case/space/punct-insensitive. */
export function lookupTerm(key: string): GlossaryTerm | undefined {
  return INDEX.get(normalizeTermKey(key));
}

/** The full glossary, served to the clients. */
export function glossaryTerms(): GlossaryTerm[] {
  return GLOSSARY;
}

/** Every recommendation type has a glossary entry (guards beginner UX coverage). */
export function recommendationTypesWithGlossary(): string[] {
  return RECOMMENDATION_TYPES.filter((t) => lookupTerm(t) !== undefined);
}
