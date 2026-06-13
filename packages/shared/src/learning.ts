import type { RecommendationType } from "./recommendations.js";
import { RECOMMENDATION_TYPES } from "./recommendations.js";

/**
 * Layer 10 — Learning System. Curated, NON-ADVISORY educational explainers that
 * sit inline next to every recommendation and risk assessment. The content is
 * static reference material (single source of truth here in `shared`), and the
 * mapping links each RecommendationType to the concepts a user should understand
 * to interpret that signal for themselves. Nothing here tells a user to buy or
 * sell — it teaches them how to read the analysis.
 */

export interface LearningContent {
  slug: string;
  title: string;
  body: string;
  tags: string[];
}

/** The curated library. Keep bodies short, plain, and educational. */
export const LEARNING_CONTENT: LearningContent[] = [
  {
    slug: "what-is-a-watch-recommendation",
    title: "What a “Watch” signal means",
    body:
      "InvestIQ never tells you to buy or sell. A “Watch” signal flags a stock as worth your attention based on the evidence, leaving the decision to you. Always weigh it against your own goals, time horizon, and risk tolerance.",
    tags: ["basics", "watch"],
  },
  {
    slug: "reading-confidence-scores",
    title: "Reading the confidence score",
    body:
      "Confidence (0–100) reflects how strong and consistent the supporting evidence is — not how much a stock will rise. High confidence means the signals agree; it is not a guarantee. Low confidence means the picture is mixed and deserves extra scrutiny.",
    tags: ["scores", "basics"],
  },
  {
    slug: "reading-risk-scores",
    title: "Reading the risk score",
    body:
      "Risk (0–100) estimates how much a position could move against you, drawing on volatility, valuation, and concentration. A higher score is not “bad” — it signals that you should size the position smaller and watch it more closely.",
    tags: ["scores", "risk", "basics"],
  },
  {
    slug: "buy-zones-and-entry-points",
    title: "Buy zones and entry points",
    body:
      "A buy zone is a price range where the risk/reward looks more favorable, not a prediction or a green light. Entering near the lower end improves your margin of safety; chasing a stock far above the zone raises your downside.",
    tags: ["risk", "entry", "levels"],
  },
  {
    slug: "stop-losses-explained",
    title: "Stop losses and protecting capital",
    body:
      "A stop loss is a pre-decided price where you would reconsider a thesis, capping how much a single position can hurt you. Setting it before you enter removes emotion from the decision. It is a discipline tool, not a forecast.",
    tags: ["risk", "levels"],
  },
  {
    slug: "profit-targets-and-risk-reward",
    title: "Profit targets and risk/reward",
    body:
      "Risk/reward compares your potential gain to the target against your potential loss to the stop. A ratio below ~1.5:1 means you are risking a lot to make a little. Targets are reference points to plan around, never promises.",
    tags: ["risk", "levels"],
  },
  {
    slug: "position-sizing",
    title: "Position sizing",
    body:
      "How much you buy matters more than what you buy. Sizing each position so a worst-case loss is survivable keeps one bad call from sinking the portfolio. Higher-risk ideas warrant smaller positions.",
    tags: ["risk", "portfolio"],
  },
  {
    slug: "diversification-and-concentration",
    title: "Diversification and concentration",
    body:
      "Concentration magnifies both gains and losses. Spreading exposure across sectors and uncorrelated holdings reduces the chance that one shock damages everything. Watch how a new position changes your overall mix, not just its own merits.",
    tags: ["portfolio", "risk"],
  },
  {
    slug: "high-risk-signals",
    title: "Understanding high-risk signals",
    body:
      "A high-risk warning means the evidence shows elevated downside — heavy volatility, stretched valuation, deteriorating fundamentals, or negative news flow. It is a prompt to slow down and dig deeper, not an automatic exit.",
    tags: ["risk", "warning"],
  },
  {
    slug: "when-to-trim-or-exit",
    title: "When to trim or reconsider a position",
    body:
      "Trimming locks in part of a gain and reduces concentration without fully leaving. Reconsidering an exit is warranted when the original thesis breaks — not because of short-term price noise. Decide your rules before emotions run high.",
    tags: ["portfolio", "risk"],
  },
  {
    slug: "rebuy-watch-explained",
    title: "What a rebuy watch means",
    body:
      "A rebuy watch flags a stock you previously held or analyzed that is approaching a more favorable setup again. It is a reminder to re-examine the current evidence, not an instruction to re-enter.",
    tags: ["watch", "entry"],
  },
  {
    slug: "etfs-vs-single-stocks",
    title: "ETFs vs. single stocks",
    body:
      "An ETF bundles many holdings, so it spreads risk but dilutes the impact of any one winner. A single stock concentrates both opportunity and risk. Neither is better in the abstract — it depends on how much single-name risk you want.",
    tags: ["basics", "portfolio"],
  },
  {
    slug: "earnings-risk",
    title: "Earnings dates and event risk",
    body:
      "Stocks can move sharply around earnings as expectations reset. Holding through a report means accepting that gap risk. Knowing when earnings land helps you decide whether to size down or wait for clarity.",
    tags: ["risk", "events"],
  },
  {
    slug: "news-and-price-impact",
    title: "How news moves prices",
    body:
      "Not all headlines matter equally — markets react to surprises versus what was already expected. A strong reaction can fade or persist. Judge news by how it changes the underlying thesis, not by the loudness of the headline.",
    tags: ["news", "basics"],
  },
  {
    slug: "avoiding-value-traps",
    title: "Avoiding value traps",
    body:
      "A cheap-looking stock can stay cheap if the business is deteriorating. A low price is only a bargain if the fundamentals are intact. Weigh why the market is discounting it before assuming it is mispriced.",
    tags: ["risk", "warning"],
  },
];

const BY_SLUG = new Map(LEARNING_CONTENT.map((c) => [c.slug, c]));

/** Resolve content by slug, or undefined when it does not exist. */
export function learningBySlug(slug: string): LearningContent | undefined {
  return BY_SLUG.get(slug);
}

/** Resolve a list of slugs to content, dropping any that no longer exist. */
function resolve(slugs: string[]): LearningContent[] {
  return slugs.map((s) => BY_SLUG.get(s)).filter((c): c is LearningContent => c != null);
}

/**
 * The link table: each recommendation type → the concepts that help a user
 * interpret it. Every slug here must exist in LEARNING_CONTENT (enforced by test).
 */
export const RECOMMENDATION_LEARNING: Record<RecommendationType, string[]> = {
  STRONG_BUY_WATCH: [
    "what-is-a-watch-recommendation",
    "buy-zones-and-entry-points",
    "reading-confidence-scores",
    "position-sizing",
  ],
  BUY_WATCH: [
    "what-is-a-watch-recommendation",
    "buy-zones-and-entry-points",
    "reading-risk-scores",
    "diversification-and-concentration",
  ],
  HOLD: ["reading-risk-scores", "when-to-trim-or-exit", "diversification-and-concentration"],
  TRIM_POSITION: ["when-to-trim-or-exit", "position-sizing", "profit-targets-and-risk-reward"],
  EXIT_CONSIDERATION: ["when-to-trim-or-exit", "stop-losses-explained", "high-risk-signals"],
  HIGH_RISK_WARNING: [
    "high-risk-signals",
    "reading-risk-scores",
    "stop-losses-explained",
    "position-sizing",
  ],
  AVOID: ["high-risk-signals", "avoiding-value-traps", "reading-risk-scores"],
  REBUY_WATCH: ["rebuy-watch-explained", "buy-zones-and-entry-points", "what-is-a-watch-recommendation"],
};

/** Concepts surfaced alongside any trade-risk assessment. */
export const RISK_LEARNING_SLUGS = [
  "reading-risk-scores",
  "buy-zones-and-entry-points",
  "stop-losses-explained",
  "profit-targets-and-risk-reward",
  "position-sizing",
];

/** Learning content relevant to a recommendation type (empty for unknown types). */
export function learningForRecommendation(recType: string): LearningContent[] {
  const slugs = (RECOMMENDATION_LEARNING as Record<string, string[]>)[recType];
  return slugs ? resolve(slugs) : [];
}

/** Learning content relevant to a trade-risk assessment. */
export function learningForRisk(): LearningContent[] {
  return resolve(RISK_LEARNING_SLUGS);
}

/** All recommendation types that have at least one learning link (for tests/admin). */
export function recommendationsWithLearning(): RecommendationType[] {
  return RECOMMENDATION_TYPES.filter((t) => learningForRecommendation(t).length > 0);
}

/**
 * The Learn hub curriculum — an ordered, beginner-first path through the whole
 * library. Every LEARNING_CONTENT slug appears in exactly one section (enforced
 * by test), so the hub is complete and nothing is orphaned.
 */
export interface LearningSection {
  title: string;
  intro: string;
  items: LearningContent[];
}

const LEARNING_SECTION_DEFS: { title: string; intro: string; slugs: string[] }[] = [
  {
    title: "Start here — the basics",
    intro: "What InvestIQ’s signals and scores actually mean.",
    slugs: [
      "what-is-a-watch-recommendation",
      "reading-confidence-scores",
      "reading-risk-scores",
      "etfs-vs-single-stocks",
    ],
  },
  {
    title: "Reading the signals",
    intro: "How news, earnings, and warnings change the picture.",
    slugs: ["news-and-price-impact", "earnings-risk", "high-risk-signals", "rebuy-watch-explained"],
  },
  {
    title: "Managing risk & entries",
    intro: "Buy zones, stops, targets, and how much to put on.",
    slugs: [
      "buy-zones-and-entry-points",
      "stop-losses-explained",
      "profit-targets-and-risk-reward",
      "position-sizing",
    ],
  },
  {
    title: "Building a portfolio",
    intro: "Putting positions together and knowing when to adjust.",
    slugs: ["diversification-and-concentration", "when-to-trim-or-exit", "avoiding-value-traps"],
  },
];

/** The curriculum, grouped into ordered sections (drops any empty section). */
export function learningSections(): LearningSection[] {
  return LEARNING_SECTION_DEFS.map((s) => ({
    title: s.title,
    intro: s.intro,
    items: resolve(s.slugs),
  })).filter((s) => s.items.length > 0);
}

/** The full flat library (for search/index). */
export function learningLibrary(): LearningContent[] {
  return LEARNING_CONTENT;
}
