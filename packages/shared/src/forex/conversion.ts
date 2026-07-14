/**
 * Forex core — currency conversion over a caller-supplied rate table.
 *
 * The conversion service core: given a `RateTable` (from a live provider, a
 * manual user entry, or the trade's own entry price) it resolves direct,
 * inverse, and USD-cross rates. PURE — the caller decides where rates come
 * from, so calculators work identically with live or manual data.
 */

/** Rates keyed by canonical pair symbol, e.g. { "EUR/USD": 1.085 }. */
export type RateTable = Record<string, number>;

/**
 * Resolve the rate to convert 1 unit of `from` into `to`.
 * Order: identity → direct ("FROM/TO") → inverse (1 / "TO/FROM") → cross via
 * USD legs. Returns null when the table can't support the conversion.
 */
export function getRate(from: string, to: string, rates: RateTable): number | null {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return 1;

  const direct = rates[`${f}/${t}`];
  if (typeof direct === "number" && direct > 0) return direct;

  const inverse = rates[`${t}/${f}`];
  if (typeof inverse === "number" && inverse > 0) return 1 / inverse;

  if (f !== "USD" && t !== "USD") {
    const leg1 = getRate(f, "USD", rates);
    const leg2 = getRate("USD", t, rates);
    if (leg1 != null && leg2 != null) return leg1 * leg2;
  }
  return null;
}

export interface ConvertInput {
  from: string;
  to: string;
  amount: number;
  rates: RateTable;
}

/** Convert an amount between currencies. Null when no rate path exists. */
export function convertAmount({ from, to, amount, rates }: ConvertInput): number | null {
  const rate = getRate(from, to, rates);
  return rate == null ? null : amount * rate;
}
