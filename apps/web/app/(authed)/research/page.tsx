import { loadQuantStatus } from "@/components/trading/load-status";
import { EmptyState, Panel, Pill, Pnl, StatTile } from "@/components/trading/ui";

export const dynamic = "force-dynamic";

/** Lab Results — where the failed tests and research detail live, off the
 * trading pages: gauntlet verdicts (active + failed), recent retests, mining
 * and improvements. */
export default async function LabResultsPage() {
  const status = await loadQuantStatus();
  const verdicts = status?.gauntlet_verdicts ?? [];
  const active = verdicts.filter((v) => v.active !== false);
  const passes = active.filter((v) => v.pass);
  const fails = active.filter((v) => !v.pass);
  const retests = status?.recent_retests ?? [];
  const mining = status?.mining;
  const improvements = status?.improvements;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-t1">Lab Results</h1>
        <p className="text-sm text-t3">
          The honest record: most strategies must fail the gauntlet — that&apos;s the system
          working.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Verdicts on file" value={verdicts.length} />
        <StatTile label="Active passes" value={passes.length} tone="pos" />
        <StatTile label="Active fails" value={fails.length} />
        <StatTile
          label="Improvements adopted"
          value={improvements ? `${improvements.adopted}` : "—"}
          sub={improvements ? `${improvements.open_count} open` : undefined}
        />
      </div>

      <Panel title={`Gauntlet verdicts (${active.length} active strategies)`}>
        {active.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-t3">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Strategy</th>
                  <th className="py-1.5 pr-3 font-medium">Market</th>
                  <th className="py-1.5 pr-3 font-medium">Verdict</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Return</th>
                  <th className="py-1.5 pr-3 text-right font-medium">B&H</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Trades</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Win %</th>
                  <th className="py-1.5 text-right font-medium">Max DD</th>
                </tr>
              </thead>
              <tbody>
                {[...passes, ...fails].map((v) => (
                  <tr key={v.strategy + v.symbol} className="border-t border-edge">
                    <td className="max-w-[18rem] truncate py-2 pr-3 text-t2">{v.strategy}</td>
                    <td className="tabular py-2 pr-3 text-xs">
                      {v.symbol} <span className="text-t3">({v.market})</span>
                    </td>
                    <td className="py-2 pr-3">
                      <Pill tone={v.pass ? "pos" : "neg"}>{v.pass ? "PASS" : "fail"}</Pill>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <Pnl value={v.return_pct} pct />
                    </td>
                    <td className="tabular py-2 pr-3 text-right text-t2">
                      {v.buy_hold_pct != null ? `${v.buy_hold_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="tabular py-2 pr-3 text-right">{v.trades ?? "—"}</td>
                    <td className="tabular py-2 pr-3 text-right">
                      {v.win_rate != null ? `${v.win_rate.toFixed(0)}%` : "—"}
                    </td>
                    <td className="tabular py-2 text-right text-t2">
                      {v.max_dd != null ? `${v.max_dd.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No verdicts in the snapshot.</EmptyState>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Recent retests (decay patrol)">
          {retests.length ? (
            <ul className="divide-y divide-edge text-sm">
              {retests.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-t2">{r.strategy}</span>
                  <span className="shrink-0 text-xs">
                    <Pill tone={r.was === "PASS" ? "pos" : "muted"}>{r.was}</Pill>
                    <span className="mx-1 text-t3">→</span>
                    <Pill tone={r.now === "PASS" ? "pos" : "neg"}>{r.now}</Pill>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No retests recorded yet.</EmptyState>
          )}
        </Panel>

        <Panel title="Research mining">
          {mining ? (
            <div className="space-y-2 text-sm text-t2">
              <p>
                Videos mined: <span className="tabular font-medium text-t1">{mining.mined}</span> /{" "}
                {mining.catalog_total} · digested{" "}
                <span className="tabular font-medium text-t1">{mining.digested}</span>
              </p>
              <p>
                Books mined: <span className="tabular font-medium text-t1">{mining.books_mined}</span>
              </p>
              {improvements?.open?.length ? (
                <details>
                  <summary className="cursor-pointer text-xs font-medium text-accent">
                    Open improvements ({improvements.open_count})
                  </summary>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-t3">
                    {improvements.open.slice(0, 15).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : (
            <EmptyState>No mining data.</EmptyState>
          )}
        </Panel>
      </div>
    </div>
  );
}
