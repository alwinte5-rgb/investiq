/**
 * Deterministic portfolio scoring (Layer 3 — Portfolio Intelligence).
 *
 * PURE and reproducible: the same holdings always produce the same scores, so a
 * stored PortfolioAnalysis can be reproduced from its inputs (a DoD requirement).
 * No randomness, no model calls, no clock. Educational / non-advisory framing —
 * "suggestions", never directives.
 */

export interface HoldingInput {
  ticker: string;
  assetType: "STOCK" | "ETF";
  sector: string | null;
  marketValue: number; // current value of the position, in account currency
}

export interface PortfolioInput {
  holdings: HoldingInput[];
  cash: number;
}

export interface SectorWeight {
  sector: string;
  pct: number; // 0..100, share of INVESTED value (excludes cash)
}

export interface PortfolioScores {
  status: "scored";
  /** 0..100, higher = healthier overall. */
  healthScore: number;
  /** 0..100, higher = riskier. */
  riskScore: number;
  /** 0..100, higher = better diversified. */
  diversificationScore: number;
  /** 0..100, higher = healthier cash allocation. */
  cashScore: number;
  totalValue: number;
  invested: number;
  cash: number;
  cashPct: number; // 0..100
  holdingsCount: number;
  sectorConcentration: SectorWeight[]; // sorted desc by pct
  /** Sectors meaningfully above an equal-sector weight. */
  overweight: SectorWeight[];
  /** Sectors meaningfully below an equal-sector weight. */
  underweight: SectorWeight[];
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
}

export interface PortfolioInsufficient {
  status: "insufficient";
  message: string;
  holdingsCount: number;
}

export type PortfolioResult = PortfolioScores | PortfolioInsufficient;

/**
 * Minimum priced holdings to produce an analysis. Set to 1 so a thin portfolio
 * isn't blocked with a roadblock — a 1–2 holding book is scored HONESTLY (it
 * shows real, high concentration + low diversification, never fabricated), which
 * naturally guides the user toward diversifying. Only a truly empty portfolio
 * (no priced holdings) returns "insufficient".
 */
export const MIN_HOLDINGS_FOR_ANALYSIS = 1;

export const INSUFFICIENT_HOLDINGS_MESSAGE = "No holdings to analyze yet.";

const UNKNOWN_SECTOR = "Unknown";

function round(n: number): number {
  return Math.round(n);
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Herfindahl–Hirschman index of a weight vector (weights sum to 1). Range [1/n, 1]. */
function hhi(weights: number[]): number {
  return weights.reduce((acc, w) => acc + w * w, 0);
}

/**
 * Score a portfolio from its stored holdings + cash. Returns `insufficient`
 * when there aren't enough priced holdings to say anything honest.
 */
export function scorePortfolio(input: PortfolioInput): PortfolioResult {
  const priced = input.holdings.filter((h) => h.marketValue > 0);
  const cash = Math.max(0, input.cash);

  if (priced.length < MIN_HOLDINGS_FOR_ANALYSIS) {
    return {
      status: "insufficient",
      message: INSUFFICIENT_HOLDINGS_MESSAGE,
      holdingsCount: priced.length,
    };
  }

  const invested = priced.reduce((acc, h) => acc + h.marketValue, 0);
  const totalValue = invested + cash;
  const cashPct = totalValue > 0 ? (cash / totalValue) * 100 : 0;

  // --- position weights (of invested) ---
  const positionWeights = priced.map((h) => h.marketValue / invested);
  const positionHhi = hhi(positionWeights);
  const largest = priced.reduce((a, b) => (b.marketValue > a.marketValue ? b : a));
  const largestPct = (largest.marketValue / invested) * 100;

  // --- sector weights (of invested) ---
  const sectorTotals = new Map<string, number>();
  for (const h of priced) {
    const sector = h.sector ?? UNKNOWN_SECTOR;
    sectorTotals.set(sector, (sectorTotals.get(sector) ?? 0) + h.marketValue);
  }
  const sectorConcentration: SectorWeight[] = [...sectorTotals.entries()]
    .map(([sector, v]) => ({ sector, pct: round((v / invested) * 100) }))
    .sort((a, b) => b.pct - a.pct || a.sector.localeCompare(b.sector));
  const sectorWeights = [...sectorTotals.values()].map((v) => v / invested);
  const sectorHhi = hhi(sectorWeights);
  const sectorCount = sectorTotals.size;
  const topSector = sectorConcentration[0]!;

  // Over/underweight vs an equal-sector benchmark (reproducible, benchmark-free).
  const equalWeightPct = 100 / sectorCount;
  const overweight = sectorConcentration.filter(
    (s) => s.pct >= Math.max(35, equalWeightPct),
  );
  const underweight = sectorConcentration.filter((s) => s.pct > 0 && s.pct < equalWeightPct * 0.5);

  const etfCount = priced.filter((h) => h.assetType === "ETF").length;
  const etfValue = priced.filter((h) => h.assetType === "ETF").reduce((a, h) => a + h.marketValue, 0);
  const etfPct = (etfValue / invested) * 100;

  // --- diversification: breadth (holdings + sectors) tempered by evenness ---
  const breadth = Math.min(1, priced.length / 15) * 0.5 + Math.min(1, sectorCount / 8) * 0.5;
  const evenness = 1 - positionHhi; // 0 (one holding) .. ~1 (perfectly even)
  const diversificationScore = round(clamp(100 * (0.5 * breadth + 0.5 * evenness)));

  // --- cash: healthiest in a 2–15% band; penalize 0 (no buffer) and >30% (drag) ---
  let cashScore: number;
  if (cashPct >= 2 && cashPct <= 15) cashScore = 100;
  else if (cashPct < 2) cashScore = round(60 + (cashPct / 2) * 40); // 60..100
  else cashScore = round(clamp(100 - (cashPct - 15) * 2)); // tapers off above 15%

  // --- risk: concentration + single-stock tilt + thin cash buffer (higher = riskier) ---
  const concentrationRisk = (positionHhi * 0.5 + sectorHhi * 0.5) * 100; // 0..100
  const singleStockTilt = (1 - etfPct / 100) * 25; // up to +25 for all single stocks
  const noBufferRisk = cashPct < 1 ? 10 : 0;
  const riskScore = round(clamp(concentrationRisk + singleStockTilt + noBufferRisk));

  // --- health: blend of good diversification, healthy cash, low risk; penalize extreme concentration ---
  const concentrationPenalty = largestPct > 25 ? (largestPct - 25) * 0.6 : 0;
  const healthScore = round(
    clamp(
      diversificationScore * 0.45 + cashScore * 0.2 + (100 - riskScore) * 0.35 - concentrationPenalty,
    ),
  );

  // --- narrative (rule-derived, non-advisory) ---
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const improvements: string[] = [];

  if (sectorCount >= 5) strengths.push(`Diversified across ${sectorCount} sectors.`);
  if (etfPct >= 40) strengths.push(`Solid ETF core (${round(etfPct)}% of invested value).`);
  if (cashPct >= 2 && cashPct <= 15) strengths.push(`Healthy cash buffer (${round(cashPct)}%).`);
  if (diversificationScore >= 70) strengths.push("Well-balanced position sizing.");

  if (largestPct > 25)
    weaknesses.push(`${largest.ticker} is ${round(largestPct)}% of invested value — concentrated.`);
  if (overweight.length > 0)
    weaknesses.push(
      `Heavy concentration in ${overweight.map((s) => `${s.sector} (${s.pct}%)`).join(", ")}.`,
    );
  if (cashPct < 1) weaknesses.push("Almost no cash buffer for opportunities or drawdowns.");
  if (cashPct > 30) weaknesses.push(`High cash drag (${round(cashPct)}% uninvested).`);
  if (sectorCount <= 2) weaknesses.push(`Only ${sectorCount} sector(s) represented.`);

  if (largestPct > 25)
    improvements.push(`Consider reducing single-name concentration in ${largest.ticker}.`);
  if (overweight.length > 0)
    improvements.push(
      `Consider adding exposure outside ${topSector.sector} to balance sector weight.`,
    );
  if (sectorCount < 5)
    improvements.push("Consider broadening across more sectors to improve diversification.");
  if (cashPct > 30)
    improvements.push("Consider deploying some idle cash to reduce cash drag.");
  if (cashPct < 1)
    improvements.push("Consider holding a small cash reserve for flexibility.");

  return {
    status: "scored",
    healthScore,
    riskScore,
    diversificationScore,
    cashScore,
    totalValue: round(totalValue),
    invested: round(invested),
    cash: round(cash),
    cashPct: round(cashPct),
    holdingsCount: priced.length,
    sectorConcentration,
    overweight,
    underweight,
    strengths,
    weaknesses,
    improvements,
  };
}
