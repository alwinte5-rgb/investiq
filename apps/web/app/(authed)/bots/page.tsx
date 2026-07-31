import { loadQuantStatus } from "@/components/trading/load-status";
import { OpenPositionsTable, TradesFeed } from "@/components/trading/panels";
import { assetClassOf, type Bot, type Incubating } from "@/components/trading/types";
import { ClassBadge, EmptyState, Panel, Pill, Pnl, fmtTime } from "@/components/trading/ui";

export const dynamic = "force-dynamic";

/** Bots — every graduated bot (active AND benched) in full detail: equity,
 * positions, recent trades, retest verdict, caveats. The per-bot limit
 * controls attach here (Phase E). */

function BotCard({ bot, paper }: { bot: Bot; paper?: Incubating }) {
  const symbols = bot.symbols?.length ? bot.symbols : [bot.symbol];
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-t1">{bot.name}</h3>
            <ClassBadge assetClass={bot.asset_class ?? assetClassOf(bot.symbol)} />
            <Pill tone={bot.benched ? "muted" : "pos"}>{bot.benched ? "benched" : "active"}</Pill>
            {paper?.running === false && !bot.benched ? (
              <Pill tone="warn">loop down</Pill>
            ) : null}
            {bot.pyramiding ? <Pill tone="accent">pyramiding</Pill> : null}
            {bot.direction ? <Pill tone="muted">{bot.direction}</Pill> : null}
          </div>
          <p className="tabular mt-0.5 text-sm text-t2">
            {symbols.join(" · ")} · {bot.timeframe}
          </p>
        </div>
        {paper ? (
          <div className="text-right">
            <p className="tabular text-lg font-semibold text-t1">
              ${paper.equity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <p className="text-sm">
              <Pnl value={paper.pnl_pct} pct />{" "}
              <span className="text-xs text-t3">
                · {paper.wins}W/{paper.losses}L · {paper.closed_trades ?? 0} closed
              </span>
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 text-xs text-t3 sm:grid-cols-3">
        <p>
          Gauntlet: <Pnl value={bot.return_pct} pct /> vs B&H{" "}
          {bot.buy_hold_pct != null ? `${bot.buy_hold_pct.toFixed(1)}%` : "—"}
        </p>
        <p>Regime tested: {bot.regime_when_tested ?? "—"}</p>
        <p>
          Last retest: {bot.last_retest_verdict ?? "—"}
          {bot.last_retest_date ? ` (${bot.last_retest_date})` : ""}
        </p>
      </div>

      {paper?.positions?.length || paper?.position ? (
        <div className="mt-3 rounded-md border border-edge bg-raised p-2">
          <OpenPositionsTable incubator={[paper]} />
        </div>
      ) : null}

      {paper?.recent_trades?.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-accent">
            Recent trades ({paper.recent_trades.length})
          </summary>
          <div className="mt-2">
            <TradesFeed incubator={[paper]} limit={6} />
          </div>
        </details>
      ) : null}

      {bot.caveats?.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-warn">
            Caveats ({bot.caveats.length})
          </summary>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-t3">
            {bot.caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </Panel>
  );
}

export default async function BotsPage() {
  const status = await loadQuantStatus();
  const bots = status?.bots ?? [];
  const paperByName = new Map((status?.incubator ?? []).map((b) => [b.strategy, b]));

  const active = bots.filter((b) => !b.benched);
  const benched = bots.filter((b) => b.benched);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-t1">Bots</h1>
        <p className="text-sm text-t3">
          {active.length} active · {benched.length} benched · updated{" "}
          {fmtTime(new Date().toISOString())}
        </p>
      </div>

      {!bots.length ? (
        <Panel>
          <EmptyState>No bot data in the snapshot yet.</EmptyState>
        </Panel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {active.map((bot) => (
          <BotCard key={bot.name} bot={bot} paper={paperByName.get(bot.name)} />
        ))}
      </div>

      {benched.length ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-t2">
            Benched bots ({benched.length})
          </summary>
          <div className="mt-3 grid gap-4 xl:grid-cols-2">
            {benched.map((bot) => (
              <BotCard key={bot.name} bot={bot} paper={paperByName.get(bot.name)} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
