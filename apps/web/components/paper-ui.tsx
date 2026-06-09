"use client";

import { useState, useTransition } from "react";
import {
  getPaperAccountAction,
  getPaperOrdersAction,
  getPaperPerformanceAction,
  submitPaperOrderAction,
  type EquityPoint,
  type PaperAccount,
  type PaperOrder,
} from "@/app/(authed)/paper/actions";

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const plColor = (n: number) => (n > 0 ? "text-green-600" : n < 0 ? "text-red-600" : "text-neutral-500");

function newKey() {
  // Per-intent idempotency token; the server dedupes retries of the same key.
  return (globalThis.crypto?.randomUUID?.() ?? `k${Date.now()}${Math.random()}`).replace(/-/g, "");
}

function EquitySparkline({ points }: { points: EquityPoint[] }) {
  if (points.length < 2) {
    return (
      <p className="text-xs text-neutral-400">
        The equity curve appears once you have at least two days of activity.
      </p>
    );
  }
  const values = points.map((p) => p.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 100;
  const h = 28;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p.equity - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const last = values[values.length - 1]!;
  const first = values[0]!;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-40" preserveAspectRatio="none">
        <path d={path} fill="none" stroke={last >= first ? "#15803d" : "#b91c1c"} strokeWidth={1.5} />
      </svg>
      <span className="text-xs text-neutral-500">
        {points.length} days · {usd(first)} → {usd(last)}
      </span>
    </div>
  );
}

export function PaperUI({
  initialAccount,
  initialOrders,
  initialPoints,
}: {
  initialAccount: PaperAccount | null;
  initialOrders: PaperOrder[];
  initialPoints: EquityPoint[];
}) {
  const [account, setAccount] = useState<PaperAccount | null>(initialAccount);
  const [orders, setOrders] = useState<PaperOrder[]>(initialOrders);
  const [points, setPoints] = useState<EquityPoint[]>(initialPoints);

  const [ticker, setTicker] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [qty, setQty] = useState("");

  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();

  async function reload() {
    const [a, o, p] = await Promise.all([
      getPaperAccountAction(),
      getPaperOrdersAction(),
      getPaperPerformanceAction(),
    ]);
    if (a.ok) setAccount(a.account);
    if (o.ok) setOrders(o.orders);
    if (p.ok) setPoints(p.points);
  }

  function submit() {
    const t = ticker.trim().toUpperCase();
    const q = Number(qty);
    if (!t) return setNotice({ tone: "err", text: "Enter a ticker symbol." });
    if (!(q > 0)) return setNotice({ tone: "err", text: "Enter a quantity greater than zero." });

    setNotice(null);
    start(async () => {
      const res = await submitPaperOrderAction({ ticker: t, side, qty: q, idempotencyKey: newKey() });
      if (!res.ok) {
        setNotice({ tone: "err", text: res.error });
        return;
      }
      const r = res.result;
      if (r.status === "rejected") {
        setNotice({ tone: "warn", text: r.reason ?? "Order rejected." });
      } else if (r.duplicate) {
        setNotice({ tone: "warn", text: "Duplicate submission ignored — this order was already placed." });
      } else {
        setNotice({
          tone: "ok",
          text: `${r.side} ${r.qty} ${r.ticker} filled at ${r.filledPrice != null ? usd(r.filledPrice) : "—"}.`,
        });
        setQty("");
      }
      await reload();
    });
  }

  const positions = account?.positions ?? [];

  return (
    <div className="space-y-5">
      {/* Account summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Equity" value={account ? usd(account.equity) : "—"} />
        <Stat label="Cash" value={account ? usd(account.cash) : "—"} />
        <Stat
          label="Total P&L"
          value={account ? usd(account.totalPl) : "—"}
          className={account ? plColor(account.totalPl) : undefined}
        />
        <Stat
          label="Return"
          value={account ? `${account.totalPlPct >= 0 ? "+" : ""}${account.totalPlPct}%` : "—"}
          className={account ? plColor(account.totalPlPct) : undefined}
        />
      </div>

      {/* Order ticket */}
      <div className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold">Place a simulated order</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Ticker</span>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              maxLength={10}
              className="w-28 rounded-md border px-2 py-1.5 text-sm uppercase"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Side</span>
            <div className="flex overflow-hidden rounded-md border">
              {(["BUY", "SELL"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={`px-3 py-1.5 text-sm font-medium ${
                    side === s
                      ? s === "BUY"
                        ? "bg-green-600 text-white"
                        : "bg-red-600 text-white"
                      : "bg-white text-neutral-600"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Quantity</span>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="10"
              className="w-28 rounded-md border px-2 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit market order"}
          </button>
        </div>
        {notice && (
          <p
            className={`mt-3 text-sm ${
              notice.tone === "ok"
                ? "text-green-600"
                : notice.tone === "warn"
                  ? "text-amber-600"
                  : "text-red-600"
            }`}
          >
            {notice.text}
          </p>
        )}
        <p className="mt-2 text-[11px] text-neutral-400">
          Market orders fill at the current quote. Simulated only — no real money or brokerage.
        </p>
      </div>

      {/* Positions */}
      <section className="rounded-lg border p-4">
        <h2 className="mb-2 text-sm font-semibold">Positions</h2>
        {positions.length === 0 ? (
          <p className="text-sm text-neutral-500">No open positions yet. Place a buy order to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-400">
                  <th className="py-1 pr-3 font-medium">Ticker</th>
                  <th className="py-1 pr-3 font-medium">Qty</th>
                  <th className="py-1 pr-3 font-medium">Avg cost</th>
                  <th className="py-1 pr-3 font-medium">Price</th>
                  <th className="py-1 pr-3 font-medium">Mkt value</th>
                  <th className="py-1 pr-3 font-medium">Unrealized</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.ticker} className="border-t">
                    <td className="py-1.5 pr-3 font-medium">{p.ticker}</td>
                    <td className="py-1.5 pr-3">{p.qty}</td>
                    <td className="py-1.5 pr-3">{usd(p.avgPrice)}</td>
                    <td className="py-1.5 pr-3">{p.price != null ? usd(p.price) : "—"}</td>
                    <td className="py-1.5 pr-3">{usd(p.marketValue)}</td>
                    <td className={`py-1.5 pr-3 ${plColor(p.unrealizedPl)}`}>{usd(p.unrealizedPl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Equity curve */}
      <section className="rounded-lg border p-4">
        <h2 className="mb-2 text-sm font-semibold">Equity curve</h2>
        <EquitySparkline points={points} />
      </section>

      {/* Orders history */}
      <section className="rounded-lg border p-4">
        <h2 className="mb-2 text-sm font-semibold">Order history</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-neutral-500">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-400">
                  <th className="py-1 pr-3 font-medium">Date</th>
                  <th className="py-1 pr-3 font-medium">Side</th>
                  <th className="py-1 pr-3 font-medium">Ticker</th>
                  <th className="py-1 pr-3 font-medium">Qty</th>
                  <th className="py-1 pr-3 font-medium">Fill</th>
                  <th className="py-1 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="py-1.5 pr-3 text-neutral-500">
                      {new Date(o.submittedAt).toLocaleDateString()}
                    </td>
                    <td className={`py-1.5 pr-3 font-medium ${o.side === "BUY" ? "text-green-600" : "text-red-600"}`}>
                      {o.side}
                    </td>
                    <td className="py-1.5 pr-3 font-medium">{o.ticker}</td>
                    <td className="py-1.5 pr-3">{o.qty}</td>
                    <td className="py-1.5 pr-3">{o.filledPrice != null ? usd(o.filledPrice) : "—"}</td>
                    <td className="py-1.5 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          o.status === "filled"
                            ? "bg-green-100 text-green-700"
                            : o.status === "rejected"
                              ? "bg-red-100 text-red-700"
                              : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold ${className ?? "text-neutral-800"}`}>{value}</div>
    </div>
  );
}
