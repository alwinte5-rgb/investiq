import { loadQuantStatus } from "@/components/trading/load-status";
import { EmptyState, Panel, Pill, Pnl } from "@/components/trading/ui";

export const dynamic = "force-dynamic";

/** Options — the options research program: build status, the (currently
 * synthetic) matrix verdicts, real-probe results, and the honest data-blocked
 * banner until the flat-file upgrade lands. */
export default async function OptionsPage() {
  const status = await loadQuantStatus();
  const program = status?.options;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-t1">Options</h1>
        <p className="text-sm text-t3">
          Full research core: Black-Scholes pricing, IV surface, 7 structures, account governor,
          gauntlet.
        </p>
      </div>

      {!program ? (
        <Panel>
          <EmptyState>No options data in the snapshot yet.</EmptyState>
        </Panel>
      ) : (
        <>
          {program.data_blocked ? (
            <div className="rounded-lg border border-warn bg-warn-soft px-4 py-3 text-sm text-warn">
              <p className="font-semibold">Data-blocked</p>
              <p className="mt-0.5">{program.note}</p>
            </div>
          ) : null}

          {program.probes?.length ? (
            <Panel title="Real-data probe (SPY, live Polygon chains)">
              {program.probes.map((probe, i) => (
                <div key={i} className="space-y-3">
                  <p className="text-xs text-t3">
                    {probe.window?.join(" → ")} · {probe.note}
                  </p>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {Object.entries(probe.results ?? {}).map(([name, r]) => (
                      <div key={name} className="rounded-md border border-edge bg-raised p-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-t1">{name}</p>
                          <Pnl value={r.stats?.["Return [%]"] as number} pct />
                        </div>
                        <p className="mt-1 text-xs text-t3">
                          vs stock signal{" "}
                          {typeof r.stats?.["Stock Signal Return [%]"] === "number"
                            ? `${(r.stats["Stock Signal Return [%]"] as number).toFixed(2)}%`
                            : "—"}{" "}
                          · at 2× spread {r.spread_2x_return_pct?.toFixed?.(2) ?? "—"}% ·{" "}
                          {r.trades?.length ?? 0} trades
                        </p>
                        {r.trades?.length ? (
                          <table className="mt-2 w-full text-xs">
                            <thead className="text-left text-t3">
                              <tr>
                                <th className="py-1 font-normal">Entry</th>
                                <th className="py-1 font-normal">Exit</th>
                                <th className="py-1 text-right font-normal">P&L</th>
                                <th className="py-1 pl-2 font-normal">Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.trades.map((t, j) => (
                                <tr key={j} className="border-t border-edge">
                                  <td className="tabular py-1">{t.entry}</td>
                                  <td className="tabular py-1">{t.exit}</td>
                                  <td className="py-1 text-right">
                                    <Pnl value={t.pnl} />
                                  </td>
                                  <td className="py-1 pl-2 text-t3">{t.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Panel>
          ) : null}

          <Panel title={`Strategy × structure matrix (${program.verdicts?.length ?? 0} pairings)`}>
            {program.verdicts?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-t3">
                    <tr>
                      <th className="py-1.5 pr-3 font-medium">Signal + structure</th>
                      <th className="py-1.5 pr-3 font-medium">Underlying</th>
                      <th className="py-1.5 pr-3 font-medium">Verdict</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Return</th>
                      <th className="py-1.5 pr-3 text-right font-medium">vs stock</th>
                      <th className="py-1.5 text-right font-medium">Trades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {program.verdicts.map((v, i) => (
                      <tr key={i} className="border-t border-edge">
                        <td className="py-2 pr-3 text-t2">{v.strategy}</td>
                        <td className="tabular py-2 pr-3">
                          {v.underlying}
                          {v.synthetic ? (
                            <span className="ml-1.5 rounded bg-raised px-1 py-0.5 text-[10px] uppercase text-t3">
                              synthetic
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">
                          <Pill tone={v.pass ? "pos" : "neg"}>{v.pass ? "PASS" : "fail"}</Pill>
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <Pnl value={v.return_pct} pct />
                        </td>
                        <td className="tabular py-2 pr-3 text-right text-t2">
                          {v.stock_return_pct != null ? `${v.stock_return_pct.toFixed(1)}%` : "—"}
                        </td>
                        <td className="tabular py-2 text-right">{v.trades ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState>No matrix verdicts yet.</EmptyState>
            )}
            <p className="mt-3 text-xs text-t3">
              Synthetic verdicts are plumbing evidence only — a Black-Scholes world has no real
              edge, so 0/16 passing is the correct honest result. Real verdicts arrive with the
              flat-file data.
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
