/** Map quant-lab symbols to TradingView symbols.
 *
 * quant-lab uses ccxt/yfinance conventions (BTC/USD, ETH/USD, AUDCAD=X, NG=F,
 * SPY, BTC-USD); TradingView wants EXCHANGE:TICKER. Unknown symbols fall back
 * to the bare uppercased ticker (TradingView resolves most US stocks/ETFs).
 */

const EXPLICIT: Record<string, string> = {
  "BTC/USD": "KRAKEN:BTCUSD",
  "BTC-USD": "BITSTAMP:BTCUSD",
  "ETH/USD": "KRAKEN:ETHUSD",
  "ETH-USD": "BITSTAMP:ETHUSD",
  "SOL/USD": "KRAKEN:SOLUSD",
  "NG=F": "NYMEX:NG1!",
  "CL=F": "NYMEX:CL1!",
  "GC=F": "COMEX:GC1!",
  "ES=F": "CME_MINI:ES1!",
  SPY: "AMEX:SPY",
  QQQ: "NASDAQ:QQQ",
  IWM: "AMEX:IWM",
  EWA: "AMEX:EWA",
  EWC: "AMEX:EWC",
};

export function toTradingView(symbol: string): string {
  const up = symbol.toUpperCase().trim();
  if (EXPLICIT[up]) return EXPLICIT[up];
  if (up.endsWith("=X")) return `FX:${up.slice(0, -2)}`;      // AUDCAD=X → FX:AUDCAD
  if (up.endsWith("=F")) return `NYMEX:${up.slice(0, -2)}1!`; // best-effort futures
  if (up.includes("/")) return `KRAKEN:${up.replace("/", "")}`;
  return up; // bare US stock/ETF — TradingView resolves the exchange
}

/** The default watch set for the ticker tape (deduped, TradingView format). */
export function tapeSymbols(raw: string[]): { proName: string; title: string }[] {
  const seen = new Set<string>();
  const out: { proName: string; title: string }[] = [];
  for (const s of raw) {
    const tv = toTradingView(s);
    if (seen.has(tv)) continue;
    seen.add(tv);
    out.push({ proName: tv, title: s.toUpperCase() });
  }
  return out;
}
