/** Shared types for the trading-command pages — mirrors the quant-lab
 * snapshot payload (reports/status.py build()). Nested shapes are loose on
 * the API by design; these types describe what the UI actually reads. */

export type Idea = { title: string; status: string };

export type Verdict = {
  strategy: string;
  pass: boolean;
  return_pct: number | null;
  buy_hold_pct: number | null;
  trades: number | null;
  win_rate: number | null;
  sharpe: number | null;
  sqn: number | null;
  max_dd: number | null;
  regime: string | null;
  symbol: string;
  market: string;
  active: boolean;
  report: string;
};

export type Retest = { date: string; strategy: string; was: string; now: string };

export type Bot = {
  name: string;
  symbol: string;
  symbols?: string[] | null;
  timeframe: string;
  status: string;
  asset_class?: string;
  return_pct: number | null;
  buy_hold_pct: number | null;
  trades: number | null;
  regime_when_tested: string | null;
  last_retest_verdict: string | null;
  last_retest_date: string | null;
  benched: boolean;
  direction?: string | null;
  params?: Record<string, number> | null;
  caveats?: string[] | null;
  gauntlet_report?: string | null;
  pyramiding?: boolean | null;
};

export type Mining = {
  mined: number;
  digested: number;
  catalog_total: number;
  last: string | null;
  books_mined: number;
};

export type Improvements = { open: string[]; open_count: number; adopted: number };

export type DataHealth = {
  archive_age_hours: number | null;
  max_age_hours: number;
  stale: boolean;
};

export type Trade = {
  time: string | null;
  action: string;
  symbol: string | null;
  price: number | null;
  pnl: number | null;
};

export type Position = {
  symbol?: string | null;
  side: "long" | "short";
  entry: number | null;
  stop: number | null;
  opened: string | null;
  units?: number | null;
};

export type Incubating = {
  strategy: string;
  equity: number;
  pnl_pct: number;
  wins: number;
  losses: number;
  closed_trades?: number;
  in_position: boolean;
  running?: boolean;
  positions?: Position[];
  position?: Position | null;
  per_symbol?: Record<string, { wins: number; losses: number }>;
  recent_trades?: Trade[];
};

export type Signal = {
  bot?: string;
  symbol?: string;
  signal?: string;
  price?: number;
  live_ready?: boolean;
  action?: string;
  entry?: number;
  stop?: number;
  units?: number;
  dollars?: number;
  risk_dollars?: number;
  fees_roundtrip?: number;
  error?: string;
};

export type PriceRow = {
  symbol: string;
  asset_class?: string;
  price?: number;
  error?: string;
};

export type AlpacaAccount = {
  equity?: string;
  last_equity?: string;
  cash?: string;
  buying_power?: string;
  portfolio_value?: string;
  options_buying_power?: string;
  options_trading_level?: number;
  status?: string;
  currency?: string;
};

export type AlpacaPosition = {
  symbol?: string;
  qty?: string;
  side?: string;
  avg_entry_price?: string;
  current_price?: string;
  market_value?: string;
  unrealized_pl?: string;
  unrealized_plpc?: string;
};

export type AlpacaOrder = {
  id?: string;
  symbol?: string;
  side?: string;
  qty?: string;
  filled_qty?: string;
  type?: string;
  status?: string;
  limit_price?: string | null;
  submitted_at?: string;
  filled_at?: string | null;
};

export type Alpaca = {
  configured: boolean;
  error?: string;
  account?: AlpacaAccount;
  positions?: AlpacaPosition[];
  orders?: AlpacaOrder[];
};

export type OptionsVerdict = {
  strategy: string;
  underlying: string;
  structure: string;
  pass: boolean;
  synthetic: boolean;
  return_pct: number | null;
  stock_return_pct: number | null;
  trades: number | null;
  model_marks?: boolean;
};

export type OptionsProbe = {
  underlying: string;
  window: string[];
  note: string;
  results: Record<
    string,
    {
      stats: Record<string, number | boolean | null>;
      spread_2x_return_pct: number;
      trades: { entry: string; exit: string; qty: number; pnl: number; reason: string }[];
    }
  >;
};

export type OptionsProgram = {
  verdicts: OptionsVerdict[];
  probes: OptionsProbe[];
  data_blocked: boolean;
  note: string;
};

export type QuantStatus = {
  backlog: { total: number; by_status: Record<string, number>; ideas: Idea[] };
  gauntlet_verdicts: Verdict[];
  recent_retests: Retest[];
  incubator: Incubating[];
  bots?: Bot[];
  mining?: Mining;
  improvements?: Improvements;
  data_health?: DataHealth;
  signals?: Signal[];
  prices?: PriceRow[];
  alpaca?: Alpaca;
  options?: OptionsProgram;
} | null;

/** Display asset-class for a quant-lab symbol (mirrors status.py). */
export function assetClassOf(symbol: string | null | undefined): string {
  const up = (symbol ?? "").toUpperCase();
  if (up.endsWith("=F")) return "futures";
  if (up.endsWith("=X")) return "forex";
  if (up.includes("/")) return "crypto";
  if (up.includes("-") && ["USD", "USDT", "EUR", "BTC"].includes(up.split("-").pop() ?? ""))
    return "crypto";
  return "stocks";
}
