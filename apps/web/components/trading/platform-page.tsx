import { loadQuantStatus } from "./load-status";
import { OpenPositionsTable, SignalsPanel, TradesFeed } from "./panels";
import { assetClassOf } from "./types";
import { EmptyState, Panel, Pill, Pnl } from "./ui";
import { TvChart } from "@/components/tv/widgets";

/** Shared scaffold for the per-platform pages (Futures / Crypto — Forex adds
 * its own extra sections): bots of one asset class, their positions, signals,
 * trades, and a live chart per traded symbol. */
export async function PlatformPage({
  assetClass,
  title,
  note,
  extra,
}: {
  assetClass: string;
  title: string;
  note?: string;
  extra?: React.ReactNode;
}) {
  const status = await loadQuantStatus();
  const bots = (status?.bots ?? []).filter(
    (b) => (b.asset_class ?? assetClassOf(b.symbol)) === assetClass,
  );
  const activeBots = bots.filter((b) => !b.benched);
  const names = new Set(bots.map((b) => b.name));
  const incubator = (status?.incubator ?? []).filter((b) => names.has(b.strategy));
  const symbols = [
    ...new Set(activeBots.flatMap((b) => (b.symbols?.length ? b.symbols : [b.symbol]))),
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-t1">{title}</h1>
        <p className="text-sm text-t3">
          {activeBots.length} active bot{activeBots.length === 1 ? "" : "s"}
          {note ? ` · ${note}` : ""}
        </p>
      </div>

      {!bots.length ? (
        <Panel>
          <EmptyState>No {assetClass} bots yet.</EmptyState>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {incubator.map((b) => (
              <div key={b.strategy} className="rounded-lg border border-edge bg-surface px-4 py-3">
                <p className="truncate text-xs text-t3">{b.strategy}</p>
                <p className="tabular text-lg font-semibold text-t1">
                  ${b.equity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                <p className="text-sm">
                  <Pnl value={b.pnl_pct} pct />{" "}
                  {b.running === false ? <Pill tone="warn">down</Pill> : null}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Open positions">
              <OpenPositionsTable incubator={incubator} filterClass={assetClass} />
            </Panel>
            <Panel title="Live signals">
              <SignalsPanel signals={status?.signals} filterClass={assetClass} />
            </Panel>
          </div>

          <Panel title="Recent trades">
            <TradesFeed incubator={incubator} filterClass={assetClass} />
          </Panel>

          {symbols.length ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {symbols.map((s) => (
                <TvChart key={s} symbol={s} height={380} />
              ))}
            </div>
          ) : null}
        </>
      )}

      {extra}
    </div>
  );
}
