/**
 * Unified factual scores derived deterministically from real data (no AI, no
 * fabrication) — for the at-a-glance scorecards across the app.
 */

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Inputs are decimals as returned by fundamentals providers (roe 0.25 = 25%). */
export interface FinancialStrengthInput {
  roe?: number | null;
  netMargin?: number | null;
  debtToEquity?: number | null;
}

/**
 * Financial Strength (0–100): a transparent quality gauge blending return on
 * equity, net margin (higher = better) and leverage (lower = better). Returns
 * null when none of the inputs are available — never a fabricated number.
 *
 * It is a heuristic summary of public fundamentals, not a prediction or advice.
 */
export function financialStrengthScore(f: FinancialStrengthInput): number | null {
  const parts: number[] = [];
  if (f.roe != null) parts.push(clamp(50 + f.roe * 150)); // 0.20 → 80, 0 → 50
  if (f.netMargin != null) parts.push(clamp(50 + f.netMargin * 200)); // 0.20 → 90
  if (f.debtToEquity != null) parts.push(clamp(85 - f.debtToEquity * 20)); // 0 → 85, 1 → 65, 2 → 45
  if (parts.length === 0) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/** Shared label for any 0–100 score, so scorecards read consistently. */
export function scoreLabel(v: number): "Excellent" | "Good" | "Fair" | "Weak" {
  return v >= 80 ? "Excellent" : v >= 60 ? "Good" : v >= 40 ? "Fair" : "Weak";
}
