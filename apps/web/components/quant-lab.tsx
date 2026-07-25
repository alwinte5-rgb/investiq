import { apiFetch } from "../lib/api";

// ---- data loading (server-only) ----

type Idea = { title: string; status: string };
type Verdict = {
  strategy: string;
  pass: boolean;
  return_pct: number | null;
  buy_hold_pct: number | null;
  trades: number | null;
  symbol?: string;
  market?: string;
};
type Retest = { date: string; strategy: string; was: string; now: string };
type Trade = {
  time: string;
  action: string;
  symbol: string;
  price: number | null;
  pnl: number | null;
};
type Position = {
  side: "long" | "short";
  entry: number | null;
  stop: number | null;
  opened: string | null;
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
  position?: Position | null;
  recent_trades?: Trade[];
};

export type QuantStatus = {
  backlog: { total: number; by_status: Record<string, number>; ideas: Idea[] };
  gauntlet_verdicts: Verdict[];
  recent_retests: Retest[];
  incubator: Incubating[];
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

  const passed = status.gauntlet_verdicts.filter((v) => v.pass);
  const failed = status.gauntlet_verdicts.filter((v) => !v.pass);
  const bots = status.incubator;
  const openPositions = bots.filter((b) => b.in_position);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Quant Lab</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
          Research → Backtest → Incubate. Strategies must beat buy-and-hold after
          fees, survive the robustness gauntlet, then prove themselves in paper
          trading. Most ideas fail — that&apos;s the system working. Educational
          only; nothing here is investment advice.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Ideas tracked", value: status.backlog.total },
          { label: "Gauntlet passed", value: passed.length },
          { label: "Gauntlet failed", value: failed.length },
          { label: "Paper bots live", value: bots.length },
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
                    </span>
                  </span>
                </div>

                {/* Current open position */}
                <div className="mt-2 text-sm">
                  {bot.position ? (
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          bot.position.side === "long"
                            ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {bot.position.side.toUpperCase()}
                      </span>
                      <span className="tabular-nums text-slate-600 dark:text-neutral-300">
                        entry {bot.position.entry ?? "—"} · stop {bot.position.stop?.toFixed?.(2) ?? bot.position.stop ?? "—"} ·
                        opened {fmtTime(bot.position.opened)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-neutral-500">flat — waiting for a signal</span>
                  )}
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
                </tr>
              ))}
              {status.gauntlet_verdicts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-400 dark:text-neutral-500">
                    No strategies tested yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
          Backtest numbers are hypotheses — only paper-trading results promote a
          strategy.
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
