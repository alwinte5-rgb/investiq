import { Snaptrade } from "snaptrade-typescript-sdk";
import { UpstreamError } from "./http.js";

/**
 * SnapTrade brokerage integration (read-only — no order placement in V1).
 * Wraps the official commercial SDK behind a typed interface and normalizes
 * SnapTrade's deeply-nested responses into flat internal shapes. Pure
 * normalizers are exported for unit testing.
 */

export interface SnapTradeUser {
  userId: string;
  userSecret: string;
}

export interface NormalizedAccount {
  externalId: string;
  name: string | null;
  number: string | null;
  currency: string;
  totalValue: number | null;
  cash: number | null;
  brokerage: string | null;
}

export interface NormalizedHolding {
  ticker: string;
  description: string | null;
  quantity: number;
  avgCost: number | null;
  price: number | null;
  marketValue: number | null;
  unrealizedPl: number | null;
}

export interface NormalizedTransaction {
  externalId: string;
  type: string;
  ticker: string | null;
  quantity: number | null;
  price: number | null;
  amount: number | null;
  currency: string | null;
  occurredAt: string; // ISO
}

// ---------- loose raw shapes (SnapTrade nests deeply) ----------
const n = (v: unknown): number | null => {
  if (v == null) return null;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
};

/**
 * Extract a ticker from SnapTrade's variably-nested symbol shape. Positions use
 * symbol.symbol.symbol; activities sometimes nest one fewer level; raw_symbol
 * appears at various depths. Descend through `.symbol` until a string is found.
 */
export function extractTicker(symbolNode: unknown): string | null {
  let cur = symbolNode as Record<string, any> | string | null | undefined;
  for (let depth = 0; depth < 4 && cur != null; depth++) {
    if (typeof cur === "string") return cur;
    if (typeof cur.raw_symbol === "string") return cur.raw_symbol;
    if (typeof cur.symbol === "string") return cur.symbol;
    cur = cur.symbol;
  }
  return null;
}

export function normalizeAccount(raw: Record<string, any>): NormalizedAccount {
  return {
    externalId: String(raw.id ?? raw.account_id ?? ""),
    name: raw.name ?? null,
    number: raw.number ?? null,
    currency: raw.balance?.total?.currency ?? raw.currency?.code ?? "USD",
    totalValue: n(raw.balance?.total?.amount ?? raw.total_value?.amount),
    cash: n(raw.cash ?? raw.balance?.cash),
    brokerage: raw.institution_name ?? raw.brokerage?.name ?? null,
  };
}

export function normalizePosition(raw: Record<string, any>): NormalizedHolding | null {
  const ticker = extractTicker(raw.symbol);
  if (!ticker) return null;
  const quantity = n(raw.units ?? raw.fractional_units) ?? 0;
  const price = n(raw.price);
  return {
    ticker: ticker.toUpperCase(),
    description: raw.symbol?.symbol?.description ?? raw.symbol?.description ?? null,
    quantity,
    avgCost: n(raw.average_purchase_price),
    price,
    marketValue: price != null ? price * quantity : null,
    unrealizedPl: n(raw.open_pnl),
  };
}

export function normalizeActivity(raw: Record<string, any>): NormalizedTransaction {
  return {
    externalId: String(raw.id ?? `${raw.trade_date ?? raw.settlement_date}-${raw.type}-${raw.amount}`),
    type: String(raw.type ?? raw.action ?? "unknown").toLowerCase(),
    ticker: extractTicker(raw.symbol)?.toUpperCase() ?? null,
    quantity: n(raw.units ?? raw.quantity),
    price: n(raw.price),
    amount: n(raw.amount),
    currency: raw.currency?.code ?? null,
    occurredAt: new Date(raw.trade_date ?? raw.settlement_date ?? Date.now()).toISOString(),
  };
}

export interface SnapTradeClient {
  registerUser(userId: string): Promise<SnapTradeUser>;
  connectionPortalUrl(user: SnapTradeUser, redirectUri?: string): Promise<string>;
  listAccounts(user: SnapTradeUser): Promise<NormalizedAccount[]>;
  getHoldings(user: SnapTradeUser, accountId: string): Promise<NormalizedHolding[]>;
  getTransactions(user: SnapTradeUser): Promise<NormalizedTransaction[]>;
  deleteUser(userId: string): Promise<void>;
}

async function call<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "snaptrade error";
    throw new UpstreamError("snaptrade", `${label}: ${msg}`);
  }
}

export function createSnapTradeClient(clientId: string, consumerKey: string): SnapTradeClient {
  const sdk = new Snaptrade({ clientId, consumerKey });

  return {
    async registerUser(userId) {
      const { data } = await call("registerUser", () =>
        sdk.authentication.registerSnapTradeUser({ userId }),
      );
      if (!data.userId || !data.userSecret) throw new UpstreamError("snaptrade", "no userSecret");
      return { userId: data.userId, userSecret: data.userSecret };
    },

    async connectionPortalUrl(user, redirectUri) {
      const { data } = await call("loginUser", () =>
        sdk.authentication.loginSnapTradeUser({
          userId: user.userId,
          userSecret: user.userSecret,
          ...(redirectUri ? { customRedirect: redirectUri } : {}),
        }),
      );
      const url = (data as { redirectURI?: string }).redirectURI;
      if (!url) throw new UpstreamError("snaptrade", "no redirectURI");
      return url;
    },

    async listAccounts(user) {
      const { data } = await call("listAccounts", () =>
        sdk.accountInformation.listUserAccounts({ userId: user.userId, userSecret: user.userSecret }),
      );
      return (data as Record<string, any>[]).map(normalizeAccount);
    },

    async getHoldings(user, accountId) {
      const { data } = await call("getHoldings", () =>
        sdk.accountInformation.getUserHoldings({
          userId: user.userId,
          userSecret: user.userSecret,
          accountId,
        }),
      );
      const positions = (data as { positions?: Record<string, any>[] }).positions ?? [];
      return positions
        .map(normalizePosition)
        .filter((h): h is NormalizedHolding => h !== null);
    },

    async getTransactions(user) {
      const { data } = await call("getTransactions", () =>
        sdk.transactionsAndReporting.getActivities({
          userId: user.userId,
          userSecret: user.userSecret,
        }),
      );
      return (data as Record<string, any>[]).map(normalizeActivity);
    },

    async deleteUser(userId) {
      await call("deleteUser", () => sdk.authentication.deleteSnapTradeUser({ userId }));
    },
  };
}
