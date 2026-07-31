import type {
  Alpaca,
  Bot,
  DataHealth,
  Incubating,
  Position,
  Signal,
  Trade,
} from "./types";
import { assetClassOf } from "./types";
import { ClassBadge, EmptyState, Panel, Pill, Pnl, fmtTime } from "./ui";

/** Composed data panels shared across the trading pages. Server components —
 * pure render from the snapshot. */

// ---------- alarms -----------------------------------------------------------

export function AlarmBanner({
  dataHealth,
  incubator,
}: {
  dataHealth?: DataHealth;
  incubator: Incubating[];
}) {
  const alarms: string[] = [];
  if (dataHealth?.stale) {
    alarms.push(
      `Moon Dev data stale (${dataHealth.archive_age_hours}h old — key may have expired)`,
    );
  }
  for (const bot of incubator) {
    if (bot.running === false) alarms.push(`${bot.strategy}: paper loop NOT running`);
    if (bot.pnl_pct <= -10) alarms.push(`${bot.strategy}: drawdown halt (${bot.pnl_pct}%)`);
  }
  if (!alarms.length) return null;
  return (
    <div className="rounded-lg border border-warn bg-warn-soft px-4 py-3 text-sm text-warn">
      <p className="font-semibold">⚠ Attention</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5">
        {alarms.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </div>
  );
}

// ---------- open positions ---------------------------------------------------

function positionsOf(bot: Incubating): Position[] {
  if (bot.positions && bot.positions.length) return bot.positions;
  if (bot.position) return [bot.position];
  return [];
}

export function OpenPositionsTable({
  incubator,
  filterClass,
}: {
  incubator: Incubating[];
  filterClass?: string;
}) {
  const rows = incubator.flatMap((bot) =>
    positionsOf(bot).map((p) => ({ bot: bot.strategy, ...p })),
  );
  const filtered = filterClass
    ? rows.filter((r) => assetClassOf(r.symbol) === filterClass)
    : rows;
  if (!filtered.length) return <EmptyState>No open positions.</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-t3">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Bot</th>
            <th className="py-1.5 pr-3 font-medium">Symbol</th>
            <th className="py-1.5 pr-3 font-medium">Class</th>
            <th className="py-1.5 pr-3 font-medium">Side</th>
            <th className="py-1.5 pr-3 text-right font-medium">Entry</th>
            <th className="py-1.5 pr-3 text-right font-medium">Stop</th>
            <th className="py-1.5 font-medium">Opened</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r, i) => (
            <tr key={i} className="border-t border-edge">
              <td className="max-w-[16rem] truncate py-2 pr-3 text-t2">{r.bot}</td>
              <td className="tabular py-2 pr-3 font-medium text-t1">{r.symbol ?? "—"}</td>
              <td className="py-2 pr-3">
                <ClassBadge assetClass={assetClassOf(r.symbol)} />
              </td>
              <td className="py-2 pr-3">
                <Pill tone={r.side === "long" ? "pos" : "warn"}>{r.side.toUpperCase()}</Pill>
              </td>
              <td className="tabular py-2 pr-3 text-right">{r.entry ?? "—"}</td>
              <td className="tabular py-2 pr-3 text-right">
                {typeof r.stop === "number" ? r.stop.toFixed(2) : (r.stop ?? "—")}
              </td>
              <td className="py-2 text-xs text-t3">{fmtTime(r.opened)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- recent trades ----------------------------------------------------

export function TradesFeed({
  incubator,
  filterClass,
  limit = 12,
}: {
  incubator: Incubating[];
  filterClass?: string;
  limit?: number;
}) {
  const rows = incubator
    .flatMap((bot) => (bot.recent_trades ?? []).map((t) => ({ bot: bot.strategy, ...t })))
    .filter((t) => (filterClass ? assetClassOf(t.symbol) === filterClass : true))
    .sort((a, b) => (b.time ?? "").localeCompare(a.time ?? ""))
    .slice(0, limit);
  if (!rows.length) return <EmptyState>No trades yet.</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-t3">
          <tr>
            <th className="py-1.5 pr-3 font-medium">When</th>
            <th className="py-1.5 pr-3 font-medium">Bot</th>
            <th className="py-1.5 pr-3 font-medium">Action</th>
            <th className="py-1.5 pr-3 font-medium">Symbol</th>
            <th className="py-1.5 pr-3 text-right font-medium">Price</th>
            <th className="py-1.5 text-right font-medium">P&L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={i} className="border-t border-edge">
              <td className="whitespace-nowrap py-2 pr-3 text-xs text-t3">{fmtTime(t.time)}</td>
              <td className="max-w-[14rem] truncate py-2 pr-3 text-t2">{t.bot}</td>
              <td className="py-2 pr-3 font-medium text-t1">{t.action}</td>
              <td className="tabular py-2 pr-3">{t.symbol ?? "—"}</td>
              <td className="tabular py-2 pr-3 text-right">{t.price ?? "—"}</td>
              <td className="py-2 text-right">
                <Pnl value={t.pnl} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- upcoming / suggested trades -------------------------------------

export function SignalsPanel({ signals, filterClass }: { signals?: Signal[]; filterClass?: string }) {
  const rows = (signals ?? [])
    .filter((s) => !s.error)
    .filter((s) => (filterClass ? assetClassOf(s.symbol) === filterClass : true));
  const firing = rows.filter((s) => s.action);
  const flat = rows.filter((s) => !s.action);
  if (!rows.length) return <EmptyState>No signal data in the last snapshot.</EmptyState>;
  return (
    <div className="space-y-3">
      {firing.length ? (
        <div className="space-y-2">
          {firing.map((s, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent bg-accent-soft px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Pill tone="accent">{s.signal?.toUpperCase()}</Pill>
                <span className="tabular font-semibold text-t1">{s.symbol}</span>
                <span className="max-w-[14rem] truncate text-xs text-t3">{s.bot}</span>
              </div>
              <div className="tabular text-xs text-t2">
                entry {s.entry} · stop {s.stop} · ${s.dollars} (risk ${s.risk_dollars})
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>No entries firing right now.</EmptyState>
      )}
      {flat.length ? (
        <p className="text-xs text-t3">
          Watching (flat): {flat.map((s) => `${s.symbol}`).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

// ---------- graduated bots table --------------------------------------------

export function BotsTable({ bots }: { bots?: Bot[] }) {
  if (!bots?.length) return <EmptyState>No graduated bots.</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-t3">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Bot</th>
            <th className="py-1.5 pr-3 font-medium">Symbol</th>
            <th className="py-1.5 pr-3 font-medium">Class</th>
            <th className="py-1.5 pr-3 font-medium">Status</th>
            <th className="py-1.5 pr-3 text-right font-medium">Return</th>
            <th className="py-1.5 pr-3 text-right font-medium">B&H</th>
            <th className="py-1.5 font-medium">Last retest</th>
          </tr>
        </thead>
        <tbody>
          {bots.map((b) => (
            <tr key={b.name} className="border-t border-edge">
              <td className="max-w-[16rem] truncate py-2 pr-3 text-t2">{b.name}</td>
              <td className="tabular py-2 pr-3 font-medium text-t1">
                {b.symbols?.length ? b.symbols.join(", ") : b.symbol}
              </td>
              <td className="py-2 pr-3">
                <ClassBadge assetClass={b.asset_class ?? assetClassOf(b.symbol)} />
              </td>
              <td className="py-2 pr-3">
                <Pill tone={b.benched ? "muted" : "pos"}>{b.benched ? "benched" : "active"}</Pill>
              </td>
              <td className="py-2 pr-3 text-right">
                <Pnl value={b.return_pct} pct />
              </td>
              <td className="tabular py-2 pr-3 text-right text-t2">
                {b.buy_hold_pct != null ? `${b.buy_hold_pct.toFixed(1)}%` : "—"}
              </td>
              <td className="py-2 text-xs text-t3">
                {b.last_retest_verdict ?? "—"}
                {b.last_retest_date ? ` · ${b.last_retest_date}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Alpaca -----------------------------------------------------------

export function AlpacaSummaryPanel({ alpaca }: { alpaca?: Alpaca }) {
  if (!alpaca?.configured) {
    return (
      <Panel title="Alpaca paper account">
        <EmptyState>Alpaca keys not configured on the quant-lab machine.</EmptyState>
      </Panel>
    );
  }
  if (alpaca.error) {
    return (
      <Panel title="Alpaca paper account">
        <p className="text-sm text-warn">Alpaca error: {alpaca.error}</p>
      </Panel>
    );
  }
  const a = alpaca.account ?? {};
  const equity = parseFloat(a.equity ?? "");
  const last = parseFloat(a.last_equity ?? "");
  const dayPnl = !Number.isNaN(equity) && !Number.isNaN(last) ? equity - last : null;
  return (
    <Panel title="Alpaca paper account">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-t3">Equity</p>
          <p className="tabular text-lg font-semibold text-t1">
            {equity ? `$${equity.toLocaleString()}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-t3">Day P&L</p>
          <p className="text-lg font-semibold">
            <Pnl value={dayPnl} />
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-t3">Buying power</p>
          <p className="tabular text-lg font-semibold text-t1">
            {a.buying_power ? `$${parseFloat(a.buying_power).toLocaleString()}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-t3">Options level</p>
          <p className="tabular text-lg font-semibold text-t1">{a.options_trading_level ?? "—"}</p>
        </div>
      </div>
      {alpaca.positions?.length ? (
        <p className="mt-3 text-xs text-t3">
          {alpaca.positions.length} open position{alpaca.positions.length === 1 ? "" : "s"}:{" "}
          {alpaca.positions.map((p) => p.symbol).join(", ")}
        </p>
      ) : (
        <p className="mt-3 text-xs text-t3">No open Alpaca positions.</p>
      )}
    </Panel>
  );
}
