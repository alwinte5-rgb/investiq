/**
 * Forex education — the 18-lesson curriculum (single source of truth, served
 * via the API). NON-ADVISORY: every lesson teaches how forex mechanics work
 * and how to plan risk — never what to trade or when. Lessons are short;
 * the interactive calculators next to them do the heavy lifting.
 */

export interface ForexLesson {
  slug: string;
  order: number;
  title: string;
  body: string;
  tags: string[];
  /** Which embedded interactive tool best illustrates the lesson. */
  interactive?: "pip" | "position-size" | "margin" | "risk-reward" | "leverage" | "sessions";
}

export const FOREX_LESSONS: ForexLesson[] = [
  {
    slug: "what-forex-is",
    order: 1,
    title: "What Forex Is",
    body:
      "Forex (foreign exchange) is the global market where currencies are traded against each other. Every trade is an exchange: when you buy one currency you are simultaneously selling another. Prices move as the relative value of two economies' currencies shifts. It is the largest financial market in the world, open 24 hours a day, five days a week, across trading sessions in different time zones.",
    tags: ["basics"],
  },
  {
    slug: "understanding-currency-pairs",
    order: 2,
    title: "Understanding Currency Pairs",
    body:
      "Currencies always trade in pairs, like EUR/USD or USD/JPY. The price of a pair is how much of the second currency one unit of the first currency buys. EUR/USD at 1.0850 means one euro buys approximately 1.0850 US dollars. Pairs are grouped into majors (most traded, usually tighter spreads), minors or crosses (no US dollar), and exotics (one emerging-market currency, often wider spreads and lower liquidity).",
    tags: ["basics", "pairs"],
  },
  {
    slug: "base-and-quote-currencies",
    order: 3,
    title: "Base and Quote Currencies",
    body:
      "In a pair like GBP/USD, the first currency (GBP) is the base and the second (USD) is the quote. The rate is always expressed as quote currency per one unit of base currency. Profits and losses on a position accrue in the quote currency, which is why a trader whose account is in a different currency needs a conversion step to know their result in their own money.",
    tags: ["basics", "pairs"],
  },
  {
    slug: "buying-and-selling-a-pair",
    order: 4,
    title: "What It Means to Buy or Sell a Pair",
    body:
      "Buying (going long) EUR/USD means you expect the euro to strengthen against the dollar; selling (going short) means you expect it to weaken. There is no separate 'short-selling' mechanism as in stocks — selling a pair is as routine as buying, because every forex trade is simply exchanging one currency for another in either direction.",
    tags: ["basics", "direction"],
  },
  {
    slug: "pips-and-pipettes",
    order: 5,
    title: "Understanding Pips and Pipettes",
    body:
      "A pip is the standard unit of price movement. For most pairs it is the fourth decimal place (0.0001); for many JPY pairs it is the second decimal place (0.01). A pipette is one tenth of a pip — the fifth decimal for most pairs, the third for JPY pairs. Knowing the pip size of your pair matters because every risk calculation starts with 'how many pips is my stop away?'",
    tags: ["pips", "basics"],
    interactive: "pip",
  },
  {
    slug: "lots-and-units",
    order: 6,
    title: "Understanding Lots and Units",
    body:
      "Position sizes are measured in currency units, usually expressed in lots: a standard lot is 100,000 units, a mini lot 10,000, a micro lot 1,000, and a nano lot 100. So 8,000 units equals 0.08 standard lots. The lot size determines how much each pip of movement is worth — which is exactly why position size, not prediction, is the main lever you control.",
    tags: ["lots", "basics"],
    interactive: "pip",
  },
  {
    slug: "position-sizing",
    order: 7,
    title: "Position Sizing",
    body:
      "Position sizing answers one question: how many units can I trade so that if my stop loss is hit, I lose only the amount I planned? The formula works backwards from your risk budget: risk amount ÷ (stop distance in pips × pip value per unit). Two traders can take the identical trade and get completely different outcomes purely because of sizing — it is the single most controllable part of trading.",
    tags: ["risk", "sizing"],
    interactive: "position-size",
  },
  {
    slug: "understanding-leverage",
    order: 8,
    title: "Understanding Leverage",
    body:
      "Leverage lets you control a position larger than your account balance — at 50:1, a $1,000 account can control up to $50,000 of currency. Leverage does not change how far prices move; it changes how much each pip is worth to you. It magnifies gains and losses equally. Broker leverage is the maximum available to you; effective leverage (position value ÷ your equity) is what you actually chose to take on.",
    tags: ["leverage", "risk"],
    interactive: "leverage",
  },
  {
    slug: "margin-versus-risk",
    order: 9,
    title: "Margin Versus Risk",
    body:
      "Margin is the deposit your broker sets aside to keep a position open — position value ÷ leverage. It is NOT the amount you can lose. Your real risk is defined by your stop loss: stop distance × pip value. A trade can require only $174 of margin while risking $20 — or require little margin while risking far more than you intended if no stop is set. Always plan risk from the stop, never from the margin.",
    tags: ["margin", "risk", "leverage"],
    interactive: "margin",
  },
  {
    slug: "stop-losses",
    order: 10,
    title: "Stop Losses",
    body:
      "A stop loss is a pre-decided exit price that caps how much a single trade can cost you. For a buy trade it normally sits below your entry; for a sell trade, above it. Deciding the stop before entering removes emotion from the exit and makes position sizing possible — without a stop distance there is no way to know what you are risking. Note that in fast markets fills can slip beyond the stop price.",
    tags: ["risk", "stops"],
    interactive: "position-size",
  },
  {
    slug: "risk-to-reward-ratios",
    order: 11,
    title: "Risk-to-Reward Ratios",
    body:
      "The risk-to-reward ratio compares what you stand to lose at your stop against what you stand to gain at your target. At 1:2 you risk one unit to potentially make two, which means you break even (before costs) winning only about 33% of trades. A higher ratio lowers the win rate you need, but no ratio guarantees profitability — targets still have to be realistic for the pair and timeframe.",
    tags: ["risk", "planning"],
    interactive: "risk-reward",
  },
  {
    slug: "forex-market-sessions",
    order: 12,
    title: "Forex Market Sessions",
    body:
      "The forex day rolls through four major sessions — Sydney, Tokyo, London, and New York. Liquidity and volatility differ by session: London and the London–New York overlap are typically the most active, while a pair tends to move most when its home markets are open. Session awareness matters for spreads and for planning when your stop is more likely to be tested by volatility.",
    tags: ["sessions", "basics"],
    interactive: "sessions",
  },
  {
    slug: "economic-events",
    order: 13,
    title: "Economic Events",
    body:
      "Scheduled releases — rate decisions, inflation (CPI), employment reports — can move currencies sharply within seconds. Around high-impact events, spreads often widen and prices can gap through stop levels. An economic calendar is a risk-awareness tool: it tells you when volatility is likely, not which direction prices will go. Many traders reduce size or stand aside right before major releases affecting their pair.",
    tags: ["events", "risk"],
  },
  {
    slug: "spread-commission-slippage",
    order: 14,
    title: "Spread, Commission, and Slippage",
    body:
      "The spread is the gap between the buy and sell price — you pay it on every trade, so a position starts slightly negative. Some brokers also charge a per-lot commission. Slippage is the difference between the price you expected and the price you were filled at, most common in fast or thin markets. These costs raise your true break-even win rate above the theoretical one, especially on short-term trades.",
    tags: ["costs"],
    interactive: "risk-reward",
  },
  {
    slug: "swap-and-rollover",
    order: 15,
    title: "Swap and Rollover",
    body:
      "Holding a position overnight incurs (or occasionally earns) a swap — a charge derived from the interest-rate difference between the two currencies. Rollover costs accumulate each night a trade stays open and are typically tripled once a week to cover the weekend. For multi-day trades, swap belongs in your cost math alongside spread and commission; exotic pairs often carry the largest rollover costs.",
    tags: ["costs", "swap"],
  },
  {
    slug: "creating-a-trade-plan",
    order: 16,
    title: "Creating a Trade Plan",
    body:
      "A trade plan states — before entry — the pair, direction, entry price, stop loss, target, risk percentage, and the reasoning behind the trade. Writing it down forces the risk math to happen while you are calm, and gives you something objective to review later. The plan check in this app compares each plan against your own risk settings so surprises surface before the trade, not after.",
    tags: ["planning", "discipline"],
  },
  {
    slug: "maintaining-a-trading-journal",
    order: 17,
    title: "Maintaining a Trading Journal",
    body:
      "A journal records what you planned, what actually happened, and how the two differed — entries, exits, size, risk, emotions, and whether you followed your rules. Over enough trades it reveals patterns no single trade can show: which sessions, pairs, or habits help or hurt you. The insight that matters most is usually about process ('my losses cluster when I oversize') rather than profit.",
    tags: ["journal", "discipline"],
  },
  {
    slug: "common-beginner-mistakes",
    order: 18,
    title: "Common Beginner Mistakes",
    body:
      "The most frequent mistakes are risk mistakes, not prediction mistakes: trading without a stop, risking a large share of the account on one idea, confusing margin with risk, oversizing because leverage allows it, revenge-trading after a loss, and holding through high-impact news unaware. Every tool in this app exists to make those mistakes visible before they cost money.",
    tags: ["basics", "discipline", "risk"],
  },
];

/** Same shape as learning.ts `LearningSection`, so Learn UIs work unchanged. */
export interface ForexLearningSection {
  title: string;
  intro: string;
  items: { slug: string; title: string; body: string; tags: string[] }[];
}

const SECTION_DEFS: { title: string; intro: string; slugs: string[] }[] = [
  {
    title: "Forex foundations",
    intro: "What the forex market is and how currency pairs are quoted.",
    slugs: ["what-forex-is", "understanding-currency-pairs", "base-and-quote-currencies", "buying-and-selling-a-pair"],
  },
  {
    title: "Pips, lots, and sizing",
    intro: "The units everything else is built on — and the sizing math that controls your risk.",
    slugs: ["pips-and-pipettes", "lots-and-units", "position-sizing"],
  },
  {
    title: "Leverage, margin, and stops",
    intro: "How borrowed buying power really works, and why margin is not your risk.",
    slugs: ["understanding-leverage", "margin-versus-risk", "stop-losses", "risk-to-reward-ratios"],
  },
  {
    title: "The market around your trade",
    intro: "Sessions, scheduled events, and the costs that eat into results.",
    slugs: ["forex-market-sessions", "economic-events", "spread-commission-slippage", "swap-and-rollover"],
  },
  {
    title: "Discipline",
    intro: "Planning, journaling, and the mistakes to design out of your process.",
    slugs: ["creating-a-trade-plan", "maintaining-a-trading-journal", "common-beginner-mistakes"],
  },
];

/** The Learn hub curriculum, grouped into ordered sections. */
export function forexLearningSections(): ForexLearningSection[] {
  return SECTION_DEFS.map((s) => ({
    title: s.title,
    intro: s.intro,
    items: s.slugs
      .map((slug) => FOREX_LESSONS.find((l) => l.slug === slug))
      .filter((l): l is ForexLesson => l != null)
      .map(({ slug, title, body, tags }) => ({ slug, title, body, tags })),
  })).filter((s) => s.items.length > 0);
}

/** The full flat lesson library (for search/index). */
export function forexLearningLibrary(): ForexLesson[] {
  return [...FOREX_LESSONS].sort((a, b) => a.order - b.order);
}

/** Reference: break-even win rates (before costs) per common reward ratio. */
export const RR_BREAK_EVEN_REFERENCE = [
  { ratio: "1:1", breakEvenPct: 50 },
  { ratio: "1:1.5", breakEvenPct: 40 },
  { ratio: "1:2", breakEvenPct: 33.3 },
  { ratio: "1:3", breakEvenPct: 25 },
] as const;
