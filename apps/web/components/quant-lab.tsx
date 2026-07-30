import { apiFetch } from "../lib/api";

// ---- data loading (server-only) ----

type Idea = { title: string; status: string };
type Verdict = {
  strategy: string;
  pass: boolean;
  return_pct: number | null;
  buy_hold_pct: number | null;
  trades: number | null;
  win_rate?: number | null;
  sharpe?: number | null;
  sqn?: number | null;
  max_dd?: number | null;
  regime?: string | null;
  active?: boolean;
  symbol?: string;
  market?: string;
};
type Retest = { date: string; strategy: string; was: string; now: string };
type Bot = {
  name: string;
  symbol: string | null;
  timeframe?: string | null;
  status: string | null;
  return_pct: number | null;
  buy_hold_pct: number | null;
  trades: number | null;
  regime_when_tested?: string | null;
  last_retest_verdict?: string | null;
  last_retest_date?: string | null;
  benched?: boolean;
};
type Mining = {
  mined: number;
  digested: number;
  catalog_total: number;
  last: string | null;
  books_mined: number;
};
type Improvements = { open: string[]; open_count: number; adopted: number };
type DataHealth = {
  archive_age_hours: number | null;
  max_age_hours: number;
  stale: boolean;
};
type Trade = {
  time: string;
  action: string;
  symbol: string;
  price: number | null;
  pnl: number | null;
};
type Position = {
  symbol?: string | null;
  side: "long" | "short";
  entry: number | null;
  stop: number | null;
  opened: string | null;
  units?: number | null;
};
type Incubating = {
  strategy: string;
  equity: number;
  pnl_pct: number;
  wins: number;
  losses: number;
  closed_trades?: number;
  in_position: boolean;
  running?: boolean;
  // A bot can now hold several positions at once (a basket / pyramided bot);
  // `position` is kept as a legacy first-element mirror for older snapshots.
  positions?: Position[];
  position?: Position | null;
  per_symbol?: Record<string, { wins: number; losses: number }>;
  recent_trades?: Trade[];
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
} | null;

export async function loadQuantStatus(): Promise<QuantStatus> {
  try {
    // ~/quant-lab's own cron pushes its status here every ~15 min via a
    // secret-authed route (routes/quant-lab.ts) — this just reads the
    // latest snapshot. No local filesystem access needed at all anymore.
    const snapshot = await apiFetch<{ data: QuantStatus; updatedAt: string } | null>(
      "/api/v1/quant-lab/snapshot",
    );
    return snapshot?.data ?? null;
  } catch {
    // No snapshot pushed yet, or the API call failed — render gracefully.
    return null;
  }
}

// ---- presentation ----

const CARD = "rounded-xl border border-slate-200 dark:border-neutral-800 dark:bg-neutral-900";

function StatusPill({ status }: { status: string }) {
  const base = status.split(" ")[0];
  const style = base.includes("pass")
    ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
    : base.includes("fail")
      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
      : "bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {base}
    </span>
  );
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

export function QuantLabDashboard({ status }: { status: QuantStatus }) {
  if (!status) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <h1 className="text-2xl font-semibold">Quant Lab</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-neutral-400">
          No status has been pushed yet from the quant-lab pipeline. It pushes a
          fresh snapshot every ~15 minutes once running — check back shortly.
        </p>
      </div>
    );
  }

  // Active-only = strategies whose files still exist (not archived). Matches
  // the local dashboard, which counts live passes rather than every historical
  // verdict (there are hundreds of dead ones).
  const activeVerdicts = status.gauntlet_verdicts.filter((v) => v.active !== false);
  const passed = activeVerdicts.filter((v) => v.pass);
  const failed = activeVerdicts.filter((v) => !v.pass);
  const bots = status.incubator;
  const openPositions = bots.filter((b) => b.in_position);
  const mining = status.mining;
  const improvements = status.improvements;
  const graduated = status.bots ?? [];
  const health = status.data_health;

  return (
    <div className="space-y-8">
      {/* Stale-data / key-expiry alarm — mirrors the local dashboard banner. */}
      {health?.stale ? (
        <div className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          ⚠️ Moon Dev data is stale ({health.archive_age_hours}h old, limit{" "}
          {health.max_age_hours}h) — the $5 API key has likely expired. Renew it to
          resume fresh liquidation/sentiment data.
        </div>
      ) : null}

      <div>
        <h1 className="text-2xl font-semibold">Quant Lab</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
          Research → Backtest → Incubate. Strategies must beat buy-and-hold after
          fees, survive the robustness gauntlet, then prove themselves in paper
          trading. Most ideas fail — that&apos;s the system working. Educational
          only; nothing here is investment advice.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Ideas tracked", value: status.backlog.total },
          { label: "Active passes", value: passed.length },
          { label: "Active fails", value: failed.length },
          { label: "Paper bots live", value: bots.length },
          {
            label: "Videos mined",
            value: mining ? `${mining.digested}/${mining.catalog_total}` : "—",
          },
        ].map((stat) => (
          <div key={stat.label} className={`${CARD} p-4 text-center`}>
            <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{stat.label}</p>
          </div>
        ))}
      </section>

      {/* Live paper bots: what each one is ACTUALLY doing right now. */}
      <section>
        <h2 className="mb-2 font-medium">
          Paper bots — live positions &amp; activity
        </h2>
        {bots.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-neutral-500">
            Nothing incubating yet — only gauntlet passes graduate here.
          </p>
        ) : (
          <div className="space-y-3">
            {bots.map((bot) => (
              <div key={bot.strategy} className={`${CARD} p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs">{bot.strategy}</span>
                  <span className="flex items-center gap-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        bot.running
                          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                      }`}
                    >
                      {bot.running ? "running" : "stopped"}
                    </span>
                    <span className="tabular-nums text-slate-500 dark:text-neutral-400">
                      ${bot.equity.toLocaleString()}{" "}
                      <span className={bot.pnl_pct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        ({bot.pnl_pct >= 0 ? "+" : ""}
                        {bot.pnl_pct.toFixed(2)}%)
                      </span>{" "}
                      · {bot.wins}W/{bot.losses}L
                      {bot.closed_trades != null ? ` · ${bot.closed_trades} closed` : ""}
                    </span>
                  </span>
                </div>

                {/* Current open position(s) — a bot may hold several at once */}
                <div className="mt-2 space-y-1 text-sm">
                  {(() => {
                    const openList =
                      bot.positions && bot.positions.length > 0
                        ? bot.positions
                        : bot.position
                          ? [bot.position]
                          : [];
                    if (openList.length === 0) {
                      return (
                        <span className="text-slate-400 dark:text-neutral-500">
                          flat — waiting for a signal
                        </span>
                      );
                    }
                    return openList.map((p, i) => (
                      <span key={i} className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            p.side === "long"
                              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {p.symbol ? `${p.symbol} ` : ""}
                          {p.side.toUpperCase()}
                        </span>
                        <span className="tabular-nums text-slate-600 dark:text-neutral-300">
                          entry {p.entry ?? "—"} · stop {p.stop?.toFixed?.(2) ?? p.stop ?? "—"} ·
                          opened {fmtTime(p.opened)}
                        </span>
                      </span>
                    ));
                  })()}
                </div>

                {/* Recent trades */}
                {bot.recent_trades && bot.recent_trades.length > 0 ? (
                  <table className="mt-3 w-full text-xs">
                    <thead className="text-left text-slate-400 dark:text-neutral-500">
                      <tr>
                        <th className="py-1 font-normal">When</th>
                        <th className="py-1 font-normal">Action</th>
                        <th className="py-1 text-right font-normal">Price</th>
                        <th className="py-1 text-right font-normal">P&amp;L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bot.recent_trades.map((t, i) => (
                        <tr key={i} className="border-t border-slate-100 dark:border-neutral-800">
                          <td className="py-1 tabular-nums text-slate-500 dark:text-neutral-400">{fmtTime(t.time)}</td>
                          <td className="py-1 font-medium">{t.action}</td>
                          <td className="py-1 text-right tabular-nums">{t.price ?? "—"}</td>
                          <td
                            className={`py-1 text-right tabular-nums ${
                              (t.pnl ?? 0) > 0
                                ? "text-green-600 dark:text-green-400"
                                : (t.pnl ?? 0) < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-slate-400 dark:text-neutral-500"
                            }`}
                          >
                            {t.pnl == null ? "—" : `${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="mt-2 text-xs text-slate-400 dark:text-neutral-500">
                    No trades yet — this strategy hasn&apos;t hit its entry
                    condition since going live.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400 dark:text-neutral-500">
          {openPositions.length} of {bots.length} bots currently hold an open
          position. Daily-bar strategies evaluate once per candle close, so
          activity is deliberate, not high-frequency.
        </p>
      </section>

      {/* Graduated bots: the return-vs-B&H + regime the dashboard shows. */}
      {graduated.length > 0 ? (
        <section>
          <h2 className="mb-2 font-medium">Graduated bots (gauntlet passes)</h2>
          <div className={`overflow-x-auto ${CARD}`}>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-neutral-950 dark:text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Bot</th>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Return vs B&amp;H</th>
                  <th className="px-3 py-2">Regime tested</th>
                  <th className="px-3 py-2">Last retest</th>
                </tr>
              </thead>
              <tbody>
                {graduated.map((b) => (
                  <tr key={b.name} className="border-t border-slate-100 dark:border-neutral-800">
                    <td className="px-3 py-2 font-mono text-xs">{b.name}</td>
                    <td className="px-3 py-2">{b.symbol ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          b.benched
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                            : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                        }`}
                      >
                        {b.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {b.return_pct != null ? `${b.return_pct.toFixed(1)}%` : "—"}
                      <span className="text-slate-400 dark:text-neutral-500">
                        {" "}
                        vs {b.buy_hold_pct != null ? `${b.buy_hold_pct.toFixed(1)}%` : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{b.regime_when_tested ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {b.last_retest_verdict ? (
                        <span
                          className={
                            b.last_retest_verdict === "PASS"
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {b.last_retest_verdict} {b.last_retest_date ?? ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Mining + knowledge: what the research pipeline is chewing through. */}
      {(mining || improvements) ? (
        <section className="grid gap-4 sm:grid-cols-2">
          {mining ? (
            <div className={`${CARD} p-4`}>
              <h3 className="mb-1 text-sm font-medium">Video mining</h3>
              <p className="text-sm text-slate-600 dark:text-neutral-300">
                <span className="font-semibold tabular-nums">{mining.mined}</span> videos
                mined · <span className="font-semibold tabular-nums">{mining.digested}</span>{" "}
                digested of {mining.catalog_total} · {mining.books_mined} books
              </p>
              {mining.last ? (
                <p className="mt-1 truncate text-xs text-slate-400 dark:text-neutral-500">
                  last: {mining.last}
                </p>
              ) : null}
            </div>
          ) : null}
          {improvements ? (
            <div className={`${CARD} p-4`}>
              <h3 className="mb-1 text-sm font-medium">Improvements &amp; new logic found</h3>
              <p className="text-sm text-slate-600 dark:text-neutral-300">
                <span className="font-semibold tabular-nums">{improvements.adopted}</span>{" "}
                adopted ·{" "}
                <span className="font-semibold tabular-nums">{improvements.open_count}</span>{" "}
                open (from mined videos, awaiting review)
              </p>
              {improvements.open.length > 0 ? (
                <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-xs text-slate-500 dark:text-neutral-400">
                  {improvements.open.slice(0, 8).map((item, i) => (
                    <li key={i} className="truncate">
                      • {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 font-medium">Strategy comparison (latest verdicts)</h2>
        <div className={`overflow-x-auto ${CARD}`}>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-neutral-950 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-2">Strategy</th>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">Verdict</th>
                <th className="px-3 py-2 text-right">Return</th>
                <th className="px-3 py-2 text-right">Buy &amp; Hold</th>
                <th className="px-3 py-2 text-right">Trades</th>
                <th className="px-3 py-2 text-right">Win%</th>
                <th className="px-3 py-2 text-right">Sharpe</th>
                <th className="px-3 py-2 text-right">Max DD</th>
                <th className="px-3 py-2">Regime</th>
              </tr>
            </thead>
            <tbody>
              {[...passed, ...failed].map((v) => (
                <tr key={v.strategy} className="border-t border-slate-100 dark:border-neutral-800">
                  <td className="px-3 py-2 font-mono text-xs">
                    {v.strategy.replace(".py", "")}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">
                      {v.market ?? "crypto"}
                      {v.symbol ? ` · ${v.symbol}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={v.pass ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                      {v.pass ? "PASS" : "FAIL"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {v.return_pct != null ? `${v.return_pct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-neutral-400">
                    {v.buy_hold_pct != null ? `${v.buy_hold_pct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {v.trades != null ? Math.round(v.trades) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-neutral-400">
                    {v.win_rate != null ? `${v.win_rate.toFixed(0)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-neutral-400">
                    {v.sharpe != null ? v.sharpe.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-neutral-400">
                    {v.max_dd != null ? `${v.max_dd.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500 dark:text-neutral-400">
                    {v.regime ?? "—"}
                  </td>
                </tr>
              ))}
              {activeVerdicts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-400 dark:text-neutral-500">
                    No strategies tested yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
          Showing {activeVerdicts.length} active strategies (archived/retired
          hidden). Backtest numbers are hypotheses — only paper-trading results
          promote a strategy.
        </p>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-2 font-medium">Idea backlog</h2>
          <ul className="space-y-1.5">
            {status.backlog.ideas.map((idea) => (
              <li key={idea.title} className="flex items-center justify-between gap-2 text-sm">
                <span>{idea.title}</span>
                <StatusPill status={idea.status} />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-medium">Recent retests</h2>
          {status.recent_retests.length > 0 ? (
            <ul className="space-y-1 text-xs text-slate-500 dark:text-neutral-400">
              {status.recent_retests.map((retest, i) => (
                <li key={i}>
                  {retest.date} · {retest.strategy.replace(".py", "")}: {retest.was} →{" "}
                  <span
                    className={
                      retest.now === "PASS"
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }
                  >
                    {retest.now}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 dark:text-neutral-500">No retests yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
