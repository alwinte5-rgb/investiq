import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ---- data loading (server-only) ----

type Idea = { title: string; status: string };
type Verdict = {
  strategy: string;
  pass: boolean;
  return_pct: number | null;
  buy_hold_pct: number | null;
  trades: number | null;
};
type Retest = { date: string; strategy: string; was: string; now: string };
type Incubating = {
  strategy: string;
  equity: number;
  pnl_pct: number;
  wins: number;
  losses: number;
  in_position: boolean;
};

export type QuantStatus = {
  backlog: { total: number; by_status: Record<string, number>; ideas: Idea[] };
  gauntlet_verdicts: Verdict[];
  recent_retests: Retest[];
  incubator: Incubating[];
} | null;

export async function loadQuantStatus(): Promise<QuantStatus> {
  const labDir = process.env.QUANT_LAB_DIR ?? path.join(os.homedir(), "quant-lab");
  try {
    const { stdout } = await execFileAsync(
      path.join(labDir, ".venv", "bin", "python"),
      [path.join(labDir, "reports", "status.py"), "--json"],
      { timeout: 20_000 }
    );
    return JSON.parse(stdout);
  } catch {
    // Lab not present on this machine (e.g. deployed env) — render gracefully.
    return null;
  }
}

// ---- presentation ----

function StatusPill({ status }: { status: string }) {
  const base = status.split(" ")[0];
  const style = base.includes("pass")
    ? "bg-green-100 text-green-800"
    : base.includes("fail")
      ? "bg-red-100 text-red-700"
      : "bg-slate-100 text-slate-600";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {base}
    </span>
  );
}

export function QuantLabDashboard({ status }: { status: QuantStatus }) {
  if (!status) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <h1 className="text-2xl font-semibold">Quant Lab</h1>
        <p className="mt-3 text-sm text-slate-600">
          The local quant-lab pipeline isn&apos;t reachable from this environment.
          It lives at <code>~/quant-lab</code> on the development machine — run the
          web app there to see live pipeline status.
        </p>
      </div>
    );
  }

  const passed = status.gauntlet_verdicts.filter((v) => v.pass);
  const failed = status.gauntlet_verdicts.filter((v) => !v.pass);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Quant Lab</h1>
        <p className="mt-1 text-sm text-slate-500">
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
          { label: "In paper incubation", value: status.incubator.length },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Strategy comparison (latest verdicts)</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">Strategy</th>
                <th className="px-3 py-2">Verdict</th>
                <th className="px-3 py-2 text-right">Return</th>
                <th className="px-3 py-2 text-right">Buy &amp; Hold</th>
                <th className="px-3 py-2 text-right">Trades</th>
              </tr>
            </thead>
            <tbody>
              {[...passed, ...failed].map((v) => (
                <tr key={v.strategy} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">
                    {v.strategy.replace(".py", "")}
                  </td>
                  <td className="px-3 py-2">
                    <span className={v.pass ? "text-green-700" : "text-red-600"}>
                      {v.pass ? "PASS" : "FAIL"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {v.return_pct != null ? `${v.return_pct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                    {v.buy_hold_pct != null ? `${v.buy_hold_pct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {v.trades != null ? Math.round(v.trades) : "—"}
                  </td>
                </tr>
              ))}
              {status.gauntlet_verdicts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                    No strategies tested yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-slate-400">
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
          <h2 className="mb-2 font-medium">Paper incubator</h2>
          {status.incubator.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing incubating yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {status.incubator.map((bot) => (
                <li key={bot.strategy} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs">{bot.strategy}</span>
                  <span className="tabular-nums">
                    ${bot.equity.toLocaleString()}{" "}
                    <span className={bot.pnl_pct >= 0 ? "text-green-700" : "text-red-600"}>
                      ({bot.pnl_pct >= 0 ? "+" : ""}
                      {bot.pnl_pct.toFixed(2)}%)
                    </span>{" "}
                    <span className="text-slate-400">
                      {bot.wins}W/{bot.losses}L{bot.in_position ? " · in position" : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {status.recent_retests.length > 0 ? (
            <>
              <h3 className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
                Recent retests
              </h3>
              <ul className="space-y-1 text-xs text-slate-500">
                {status.recent_retests.map((retest, i) => (
                  <li key={i}>
                    {retest.date} · {retest.strategy.replace(".py", "")}: {retest.was} →{" "}
                    {retest.now}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
