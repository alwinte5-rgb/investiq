/**
 * Forex core — pip and pair primitives.
 *
 * PURE math and metadata helpers shared by every calculator: what a pip is for
 * a given pair, how to convert a price distance into pips (and back), and how
 * prices should be formatted. No I/O, no clock — same inputs, same outputs.
 */

/** The account currencies InvestIQ Forex supports. */
export const ACCOUNT_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "NZD", "CHF"] as const;
export type AccountCurrency = (typeof ACCOUNT_CURRENCIES)[number];

export interface PairParts {
  base: string;
  quote: string;
}

/** Parse "EUR/USD" (or "EURUSD") into base/quote. Returns null when malformed. */
export function splitPair(symbol: string): PairParts | null {
  const s = symbol.trim().toUpperCase();
  const m = s.match(/^([A-Z]{3})\/?([A-Z]{3})$/);
  if (m && m[1] && m[2]) return { base: m[1], quote: m[2] };
  return null;
}

/** Canonical "BASE/QUOTE" form, or null when the symbol is malformed. */
export function normalizePair(symbol: string): string | null {
  const parts = splitPair(symbol);
  return parts ? `${parts.base}/${parts.quote}` : null;
}

/**
 * Instrument-specific pip-size exceptions (keyed by canonical "BASE/QUOTE").
 * Empty today; metals/index CFDs or unusual pairs can be added without touching
 * the calculators.
 */
export const PIP_SIZE_OVERRIDES: Record<string, number> = {};

/** Pip size: 0.01 for JPY-quoted pairs, otherwise 0.0001 (unless overridden). */
export function pipSizeFor(symbol: string): number {
  const canonical = normalizePair(symbol);
  if (canonical && PIP_SIZE_OVERRIDES[canonical] != null) return PIP_SIZE_OVERRIDES[canonical];
  const parts = splitPair(symbol);
  return parts?.quote === "JPY" ? 0.01 : 0.0001;
}

/** Pipette = one tenth of a pip (5th decimal for most pairs, 3rd for JPY quotes). */
export function pipetteSizeFor(symbol: string): number {
  return pipSizeFor(symbol) / 10;
}

/** Decimal places brokers typically quote (pipette precision). */
export function priceDecimalsFor(symbol: string): number {
  return pipSizeFor(symbol) === 0.01 ? 3 : 5;
}

/** Convert an absolute price distance into pips for the pair. */
export function priceDiffToPips(priceDiff: number, pipSize: number): number {
  if (!(pipSize > 0)) return 0;
  return Math.abs(priceDiff) / pipSize;
}

/** Convert a pip count into an absolute price distance for the pair. */
export function pipsToPriceDiff(pips: number, pipSize: number): number {
  return Math.abs(pips) * pipSize;
}

/** Format a price at the pair's typical precision (e.g. 1.08500, 145.250). */
export function formatPairPrice(price: number, symbol: string): string {
  return price.toFixed(priceDecimalsFor(symbol));
}
