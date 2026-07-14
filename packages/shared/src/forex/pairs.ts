/**
 * Forex core — the currency-pair catalog (single source of truth).
 *
 * Static, educational metadata for every pair the product covers: seeded into
 * the DB, served by the API, and used by the calculators. Education labels are
 * neutral risk descriptions — no pair is ever "easy" or "profitable".
 */

import { pipSizeFor, pipetteSizeFor } from "./pips.js";

export type PairCategory = "MAJOR" | "MINOR" | "EXOTIC";

export interface CurrencyPairInfo {
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  displayName: string;
  category: PairCategory;
  pipSize: number;
  pipetteSize: number;
  /** Sessions during which the pair is commonly most active. */
  sessions: string[];
  centralBanks: string[];
  economies: string[];
  /** Economic events traders commonly watch for this pair. */
  commonEvents: string[];
  /** Neutral, educational liquidity/spread/volatility labels. */
  educationLabels: string[];
  description: string;
  active: boolean;
}

function pair(
  symbol: string,
  displayName: string,
  category: PairCategory,
  info: Omit<CurrencyPairInfo, "symbol" | "displayName" | "category" | "baseCurrency" | "quoteCurrency" | "pipSize" | "pipetteSize" | "active">
): CurrencyPairInfo {
  const [base = "", quote = ""] = symbol.split("/");
  return {
    symbol,
    baseCurrency: base,
    quoteCurrency: quote,
    displayName,
    category,
    pipSize: pipSizeFor(symbol),
    pipetteSize: pipetteSizeFor(symbol),
    active: true,
    ...info,
  };
}

export const CURRENCY_PAIRS: CurrencyPairInfo[] = [
  // ── Majors ─────────────────────────────────────────────────────────────────
  pair("EUR/USD", "Euro / US Dollar", "MAJOR", {
    sessions: ["London", "New York"],
    centralBanks: ["European Central Bank (ECB)", "Federal Reserve (Fed)"],
    economies: ["Eurozone", "United States"],
    commonEvents: ["ECB rate decisions", "US Non-Farm Payrolls", "US CPI", "Eurozone CPI"],
    educationLabels: ["Generally higher liquidity", "Typically tighter spreads"],
    description:
      "The most traded currency pair in the world. The rate is how many US dollars one euro buys.",
  }),
  pair("GBP/USD", "British Pound / US Dollar", "MAJOR", {
    sessions: ["London", "New York"],
    centralBanks: ["Bank of England (BoE)", "Federal Reserve (Fed)"],
    economies: ["United Kingdom", "United States"],
    commonEvents: ["BoE rate decisions", "UK CPI", "US Non-Farm Payrolls"],
    educationLabels: ["Generally higher liquidity", "Can move sharply around UK data"],
    description: "Often called 'Cable'. The rate is how many US dollars one British pound buys.",
  }),
  pair("USD/JPY", "US Dollar / Japanese Yen", "MAJOR", {
    sessions: ["Tokyo", "New York"],
    centralBanks: ["Federal Reserve (Fed)", "Bank of Japan (BoJ)"],
    economies: ["United States", "Japan"],
    commonEvents: ["BoJ policy decisions", "US CPI", "US rate decisions"],
    educationLabels: ["Generally higher liquidity", "JPY pairs use a 0.01 pip size"],
    description:
      "The rate is how many Japanese yen one US dollar buys. Note the pip is the second decimal place.",
  }),
  pair("USD/CHF", "US Dollar / Swiss Franc", "MAJOR", {
    sessions: ["London", "New York"],
    centralBanks: ["Federal Reserve (Fed)", "Swiss National Bank (SNB)"],
    economies: ["United States", "Switzerland"],
    commonEvents: ["SNB policy decisions", "US CPI"],
    educationLabels: ["Generally higher liquidity", "Franc can strengthen in risk-off periods"],
    description: "The rate is how many Swiss francs one US dollar buys.",
  }),
  pair("AUD/USD", "Australian Dollar / US Dollar", "MAJOR", {
    sessions: ["Sydney", "New York"],
    centralBanks: ["Reserve Bank of Australia (RBA)", "Federal Reserve (Fed)"],
    economies: ["Australia", "United States"],
    commonEvents: ["RBA rate decisions", "Australian employment data", "Chinese economic data"],
    educationLabels: ["Generally higher liquidity", "Sensitive to commodity prices"],
    description: "The rate is how many US dollars one Australian dollar buys.",
  }),
  pair("USD/CAD", "US Dollar / Canadian Dollar", "MAJOR", {
    sessions: ["New York"],
    centralBanks: ["Federal Reserve (Fed)", "Bank of Canada (BoC)"],
    economies: ["United States", "Canada"],
    commonEvents: ["BoC rate decisions", "Canadian employment data", "Oil inventory reports"],
    educationLabels: ["Generally higher liquidity", "Sensitive to oil prices"],
    description: "The rate is how many Canadian dollars one US dollar buys.",
  }),
  pair("NZD/USD", "New Zealand Dollar / US Dollar", "MAJOR", {
    sessions: ["Sydney", "New York"],
    centralBanks: ["Reserve Bank of New Zealand (RBNZ)", "Federal Reserve (Fed)"],
    economies: ["New Zealand", "United States"],
    commonEvents: ["RBNZ rate decisions", "NZ dairy auctions", "US CPI"],
    educationLabels: ["Lower liquidity during some sessions", "Sensitive to commodity prices"],
    description: "The rate is how many US dollars one New Zealand dollar buys.",
  }),

  // ── Minors / crosses ───────────────────────────────────────────────────────
  pair("EUR/GBP", "Euro / British Pound", "MINOR", {
    sessions: ["London"],
    centralBanks: ["European Central Bank (ECB)", "Bank of England (BoE)"],
    economies: ["Eurozone", "United Kingdom"],
    commonEvents: ["ECB rate decisions", "BoE rate decisions", "UK and Eurozone CPI"],
    educationLabels: ["Potentially wider spreads than majors"],
    description: "A cross with no US dollar leg. The rate is how many pounds one euro buys.",
  }),
  pair("EUR/JPY", "Euro / Japanese Yen", "MINOR", {
    sessions: ["Tokyo", "London"],
    centralBanks: ["European Central Bank (ECB)", "Bank of Japan (BoJ)"],
    economies: ["Eurozone", "Japan"],
    commonEvents: ["ECB rate decisions", "BoJ policy decisions"],
    educationLabels: ["Increased volatility", "JPY pairs use a 0.01 pip size"],
    description: "A yen cross. The rate is how many yen one euro buys.",
  }),
  pair("GBP/JPY", "British Pound / Japanese Yen", "MINOR", {
    sessions: ["Tokyo", "London"],
    centralBanks: ["Bank of England (BoE)", "Bank of Japan (BoJ)"],
    economies: ["United Kingdom", "Japan"],
    commonEvents: ["BoE rate decisions", "BoJ policy decisions", "UK CPI"],
    educationLabels: ["Increased volatility", "Potentially wider spreads", "JPY pairs use a 0.01 pip size"],
    description:
      "A yen cross known for larger daily ranges — position sizing discipline matters especially here.",
  }),
  pair("AUD/JPY", "Australian Dollar / Japanese Yen", "MINOR", {
    sessions: ["Sydney", "Tokyo"],
    centralBanks: ["Reserve Bank of Australia (RBA)", "Bank of Japan (BoJ)"],
    economies: ["Australia", "Japan"],
    commonEvents: ["RBA rate decisions", "BoJ policy decisions", "Chinese economic data"],
    educationLabels: ["Increased volatility", "JPY pairs use a 0.01 pip size"],
    description: "A yen cross often sensitive to global risk sentiment and commodity prices.",
  }),
  pair("EUR/CHF", "Euro / Swiss Franc", "MINOR", {
    sessions: ["London"],
    centralBanks: ["European Central Bank (ECB)", "Swiss National Bank (SNB)"],
    economies: ["Eurozone", "Switzerland"],
    commonEvents: ["ECB rate decisions", "SNB policy decisions"],
    educationLabels: ["Potentially wider spreads than majors", "Can move sharply on SNB action"],
    description: "The rate is how many Swiss francs one euro buys.",
  }),

  // ── Exotics ────────────────────────────────────────────────────────────────
  pair("USD/MXN", "US Dollar / Mexican Peso", "EXOTIC", {
    sessions: ["New York"],
    centralBanks: ["Federal Reserve (Fed)", "Banco de México (Banxico)"],
    economies: ["United States", "Mexico"],
    commonEvents: ["Banxico rate decisions", "US CPI", "Mexican inflation data"],
    educationLabels: ["Potentially wider spreads", "Increased volatility", "Possible rollover cost concerns"],
    description: "An exotic pair. The rate is how many Mexican pesos one US dollar buys.",
  }),
  pair("USD/ZAR", "US Dollar / South African Rand", "EXOTIC", {
    sessions: ["London", "New York"],
    centralBanks: ["Federal Reserve (Fed)", "South African Reserve Bank (SARB)"],
    economies: ["United States", "South Africa"],
    commonEvents: ["SARB rate decisions", "US CPI", "Commodity price moves"],
    educationLabels: ["Lower liquidity during certain sessions", "Potentially wider spreads", "Increased volatility"],
    description: "An exotic pair. The rate is how many rand one US dollar buys.",
  }),
  pair("USD/SGD", "US Dollar / Singapore Dollar", "EXOTIC", {
    sessions: ["Tokyo", "London"],
    centralBanks: ["Federal Reserve (Fed)", "Monetary Authority of Singapore (MAS)"],
    economies: ["United States", "Singapore"],
    commonEvents: ["MAS policy statements", "US CPI"],
    educationLabels: ["Potentially wider spreads", "Lower liquidity during certain sessions"],
    description: "An exotic pair. The rate is how many Singapore dollars one US dollar buys.",
  }),
];

/** The pairs shown on a new user's watchlist, in display order. */
export const DEFAULT_WATCHLIST_SYMBOLS = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "USD/CHF",
  "AUD/USD",
  "USD/CAD",
  "NZD/USD",
  "EUR/GBP",
  "EUR/JPY",
  "GBP/JPY",
];

export function findPair(symbol: string): CurrencyPairInfo | undefined {
  const s = symbol.trim().toUpperCase().replace(/-/g, "/");
  return CURRENCY_PAIRS.find((p) => p.symbol === s || p.symbol.replace("/", "") === s.replace("/", ""));
}

/** Plain-language explanation of a live rate, per the product spec. */
export function explainRate(info: CurrencyPairInfo, rate: number): string {
  return `${info.symbol} at ${rate} means one ${info.baseCurrency} can currently purchase approximately ${rate} ${info.quoteCurrency}.`;
}

/** Plain-language buy/sell meaning for a pair. */
export function directionExplanations(info: CurrencyPairInfo): { buy: string; sell: string } {
  return {
    buy: `Buying ${info.symbol} means you expect the ${info.baseCurrency} to strengthen relative to the ${info.quoteCurrency}.`,
    sell: `Selling ${info.symbol} means you expect the ${info.baseCurrency} to weaken relative to the ${info.quoteCurrency}.`,
  };
}
