import { loadQuantStatus } from "@/components/trading/load-status";
import { AlpacaSummaryPanel } from "@/components/trading/panels";
import { EmptyState, Panel, Pill, Pnl, fmtMoney, fmtTime } from "@/components/trading/ui";

export const dynamic = "force-dynamic";

/** Alpaca — the paper brokerage account in full: equity, buying power, open
 * positions with live P&L, and the order/fill history. Read-only by design;
 * orders are placed by the Mac-side mirror runner, never from the web. */
export default async function AlpacaPage() {
  const status = await loadQuantStatus();
  const alpaca = status?.alpaca;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-t1">Alpaca paper trading</h1>
        <p className="text-sm text-t3">
          Real order lifecycle, fake money. The validated stock bots mirror their signals here;
          promotion beyond paper is a human decision only.
        </p>
      </div>

      <AlpacaSummaryPanel alpaca={alpaca} />

      {alpaca?.configured && !alpaca.error ? (
        <>
          <Panel title={`Open positions (${alpaca.positions?.length ?? 0})`}>
            {alpaca.positions?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-t3">
                    <tr>
                      <th className="py-1.5 pr-3 font-medium">Symbol</th>
                      <th className="py-1.5 pr-3 font-medium">Side</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Qty</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Avg entry</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Now</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Value</th>
                      <th className="py-1.5 text-right font-medium">Unrealized</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alpaca.positions.map((p, i) => (
                      <tr key={i} className="border-t border-edge">
                        <td className="tabular py-2 pr-3 font-medium text-t1">{p.symbol}</td>
                        <td className="py-2 pr-3">
                          <Pill tone={p.side === "long" ? "pos" : "warn"}>{p.side}</Pill>
                        </td>
                        <td className="tabular py-2 pr-3 text-right">{p.qty}</td>
                        <td className="tabular py-2 pr-3 text-right">{fmtMoney(p.avg_entry_price)}</td>
                        <td className="tabular py-2 pr-3 text-right">{fmtMoney(p.current_price)}</td>
                        <td className="tabular py-2 pr-3 text-right">{fmtMoney(p.market_value)}</td>
                        <td className="py-2 text-right">
                          <Pnl value={p.unrealized_pl ? parseFloat(p.unrealized_pl) : null} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState>No open positions.</EmptyState>
            )}
          </Panel>

          <Panel title="Recent orders">
            {alpaca.orders?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-t3">
                    <tr>
                      <th className="py-1.5 pr-3 font-medium">Submitted</th>
                      <th className="py-1.5 pr-3 font-medium">Symbol</th>
                      <th className="py-1.5 pr-3 font-medium">Side</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Qty</th>
                      <th className="py-1.5 pr-3 font-medium">Type</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Limit</th>
                      <th className="py-1.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alpaca.orders.map((o, i) => (
                      <tr key={o.id ?? i} className="border-t border-edge">
                        <td className="whitespace-nowrap py-2 pr-3 text-xs text-t3">
                          {fmtTime(o.submitted_at)}
                        </td>
                        <td className="tabular py-2 pr-3 font-medium text-t1">{o.symbol}</td>
                        <td className="py-2 pr-3">
                          <Pill tone={o.side === "buy" ? "pos" : "warn"}>{o.side}</Pill>
                        </td>
                        <td className="tabular py-2 pr-3 text-right">
                          {o.filled_qty && o.filled_qty !== "0" ? `${o.filled_qty}/` : ""}
                          {o.qty}
                        </td>
                        <td className="py-2 pr-3 text-xs text-t2">{o.type}</td>
                        <td className="tabular py-2 pr-3 text-right">
                          {o.limit_price ? fmtMoney(o.limit_price) : "—"}
                        </td>
                        <td className="py-2">
                          <Pill
                            tone={
                              o.status === "filled"
                                ? "pos"
                                : o.status === "canceled" || o.status === "expired"
                                  ? "muted"
                                  : "accent"
                            }
                          >
                            {o.status}
                          </Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState>No orders yet — the mirror runner places them after market close.</EmptyState>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
}
