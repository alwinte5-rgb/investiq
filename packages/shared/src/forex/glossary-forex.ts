/**
 * Forex glossary — plain-English definitions of every forex term the product
 * surfaces. Same contract as the original glossary: `short` is a one-line
 * tooltip a beginner can read at a glance, `full` adds nuance, definitions are
 * NON-ADVISORY (what a term means, never what to do about it).
 */

import type { GlossaryTerm } from "../glossary.js";

/** Same contract as glossary.ts `glossaryTerms()`, forex content. */
export function forexGlossaryTerms(): GlossaryTerm[] {
  return FOREX_GLOSSARY;
}

export const FOREX_GLOSSARY: GlossaryTerm[] = [
  {
    term: "Pip",
    keys: ["pip", "pips"],
    short: "The standard unit of price movement — the 4th decimal place for most pairs, the 2nd for many JPY pairs.",
    full: "EUR/USD moving from 1.0850 to 1.0851 is a one-pip move. Pip size matters because risk is measured as 'stop distance in pips × pip value'.",
  },
  {
    term: "Pipette",
    keys: ["pipette", "pipettes", "fractional pip"],
    short: "One tenth of a pip — the 5th decimal place for most pairs, the 3rd for JPY pairs.",
  },
  {
    term: "Currency Pair",
    keys: ["currency pair", "pair"],
    short: "Two currencies quoted against each other, like EUR/USD — buying one always means selling the other.",
  },
  {
    term: "Base Currency",
    keys: ["base currency", "base"],
    short: "The first currency in a pair — the rate says how much of the quote currency one unit of the base buys.",
  },
  {
    term: "Quote Currency",
    keys: ["quote currency", "quote"],
    short: "The second currency in a pair — profits and losses accrue in this currency before conversion to your account currency.",
  },
  {
    term: "Lot",
    keys: ["lot", "lots", "lot size"],
    short: "A standardized position size: standard = 100,000 units, mini = 10,000, micro = 1,000, nano = 100.",
    full: "8,000 currency units equals 0.08 standard lots. Lot size determines how much money each pip of movement is worth.",
  },
  {
    term: "Units",
    keys: ["units", "position units", "currency units"],
    short: "The raw amount of base currency a position controls — lots are just a shorthand for unit counts.",
  },
  {
    term: "Leverage",
    keys: ["leverage", "broker leverage"],
    short: "Borrowed buying power — at 50:1 you can control a position 50× your margin. It magnifies gains and losses equally.",
    full: "Broker leverage is the maximum offered to you. Effective leverage — position value divided by your equity — is what you actually took on, and is usually the more important number.",
  },
  {
    term: "Effective Leverage",
    keys: ["effective leverage"],
    short: "Your position's total value divided by your account equity — the leverage you actually chose, regardless of what the broker allows.",
  },
  {
    term: "Margin",
    keys: ["margin", "required margin", "margin requirement"],
    short: "The deposit your broker reserves to keep a position open (position value ÷ leverage). It is NOT the maximum you can lose.",
    full: "Your real risk is set by your stop loss, not your margin. A trade can require $174 of margin while risking only $20 — or risk far more than its margin if no stop is set.",
  },
  {
    term: "Free Margin",
    keys: ["free margin", "available margin"],
    short: "Account equity minus the margin currently reserved — what's left to absorb losses or open new positions.",
  },
  {
    term: "Margin Call",
    keys: ["margin call"],
    short: "A broker's demand (or automatic action) when equity falls too low relative to the margin your positions require — rules vary by broker.",
  },
  {
    term: "Notional Value",
    keys: ["notional", "notional value", "position value", "exposure"],
    short: "The full market value a position controls — units × price — usually far larger than the margin posted for it.",
  },
  {
    term: "Pip Value",
    keys: ["pip value"],
    short: "How much money one pip of movement is worth for your position size, expressed in your account currency.",
  },
  {
    term: "Stop Loss",
    keys: ["stop loss", "stop-loss", "stop"],
    short: "A pre-decided exit price that caps a trade's loss — normally below entry for buys, above entry for sells.",
    full: "The stop distance in pips is the anchor of every position-size calculation. In fast markets a fill can slip beyond the stop price, so treat the capped loss as an estimate.",
  },
  {
    term: "Take Profit",
    keys: ["take profit", "take-profit", "target", "profit target"],
    short: "A pre-decided exit price that locks in a gain if reached — normally above entry for buys, below entry for sells.",
  },
  {
    term: "Position Sizing",
    keys: ["position sizing", "position size"],
    short: "Choosing how many units to trade so that hitting your stop loses exactly your planned risk amount — the most controllable part of trading.",
  },
  {
    term: "Risk-to-Reward Ratio",
    keys: ["risk-to-reward", "risk to reward", "risk/reward", "reward ratio", "r:r", "rr"],
    short: "Potential reward at the target compared with the risk at the stop, written like 1:2 — risking one unit to potentially make two.",
    full: "At 1:2 you break even (before costs) winning about 33% of trades; at 1:1 you need about 50%. A higher ratio lowers the win rate you need but does not guarantee profitability.",
  },
  {
    term: "Break-Even Win Rate",
    keys: ["break-even win rate", "breakeven win rate", "break even"],
    short: "The percentage of trades you must win, before costs, for a given risk-to-reward ratio to net out to zero: risk ÷ (risk + reward).",
  },
  {
    term: "Spread",
    keys: ["spread", "spreads"],
    short: "The gap between the buy and sell price — a cost you pay on every trade, which widens in volatile or thin markets.",
  },
  {
    term: "Commission",
    keys: ["commission"],
    short: "A per-trade or per-lot fee some brokers charge in addition to (or instead of) a wider spread.",
  },
  {
    term: "Slippage",
    keys: ["slippage"],
    short: "The difference between the price you expected and the price you were actually filled at — most common around news and in thin markets.",
  },
  {
    term: "Swap",
    keys: ["swap", "rollover", "overnight fee"],
    short: "The overnight cost (occasionally a credit) of holding a position, derived from the interest-rate difference between the two currencies.",
  },
  {
    term: "Long",
    keys: ["long", "going long", "buy"],
    short: "Buying a pair — expecting the base currency to strengthen against the quote currency.",
  },
  {
    term: "Short",
    keys: ["short", "going short", "sell"],
    short: "Selling a pair — expecting the base currency to weaken against the quote currency.",
  },
  {
    term: "Market Session",
    keys: ["market session", "trading session", "session"],
    short: "One of the four major trading windows — Sydney, Tokyo, London, New York — during which liquidity and volatility differ.",
  },
  {
    term: "Session Overlap",
    keys: ["session overlap", "overlap"],
    short: "Hours when two sessions are open at once (notably London–New York) — typically the most liquid time of day.",
  },
  {
    term: "Economic Calendar",
    keys: ["economic calendar", "economic event", "high-impact event"],
    short: "The schedule of data releases and central-bank decisions that can move currencies sharply — a volatility-awareness tool, not a trade signal.",
  },
  {
    term: "Major Pairs",
    keys: ["major pairs", "majors"],
    short: "The most-traded USD pairs (like EUR/USD and USD/JPY) — generally the highest liquidity and tightest spreads.",
  },
  {
    term: "Cross Pairs",
    keys: ["cross pairs", "crosses", "minor pairs", "minors"],
    short: "Pairs without the US dollar, like EUR/GBP — often slightly wider spreads than majors.",
  },
  {
    term: "Exotic Pairs",
    keys: ["exotic pairs", "exotics"],
    short: "Pairs with one emerging-market currency, like USD/MXN — typically wider spreads, lower liquidity, and larger rollover costs.",
  },
  {
    term: "R-Multiple",
    keys: ["r-multiple", "r multiple", "r"],
    short: "A trade's result measured in units of its planned risk — a +2R trade made twice what it risked; −1R means the stop was hit as planned.",
  },
  {
    term: "Equity",
    keys: ["equity", "account equity"],
    short: "Your account balance including the floating profit or loss of open positions.",
  },
  {
    term: "Drawdown",
    keys: ["drawdown"],
    short: "The decline from an account's peak value — a measure of how deep a losing stretch has cut.",
  },
];
