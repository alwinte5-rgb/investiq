import { loadQuantStatus } from "@/components/trading/load-status";
import { EmptyState, Panel, Pill, StatTile } from "@/components/trading/ui";

export const dynamic = "force-dynamic";

/** Ideas — the research backlog on its own page (per user request: ideas on a
 * page, failed tests elsewhere). Pending ideas front and center; tested ones
 * summarized. */

function toneFor(status: string): "pos" | "neg" | "warn" | "muted" {
  if (status.includes("pass")) return "pos";
  if (status.includes("fail")) return "neg";
  if (status.includes("pending")) return "warn";
  return "muted";
}

export default async function IdeasPage() {
  const status = await loadQuantStatus();
  const backlog = status?.backlog;
  const ideas = backlog?.ideas ?? [];
  const pending = ideas.filter((i) => i.status.includes("pending"));
  const passed = ideas.filter((i) => i.status.includes("pass"));
  const failed = ideas.filter((i) => i.status.includes("fail"));
  const other = ideas.filter(
    (i) => !i.status.includes("pending") && !i.status.includes("pass") && !i.status.includes("fail"),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-t1">Ideas</h1>
        <p className="text-sm text-t3">
          The strategy backlog — every idea flows: pending → gauntlet → pass (incubate) or fail
          (archive).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total tracked" value={backlog?.total ?? "—"} />
        <StatTile label="Pending" value={pending.length} tone={pending.length ? "warn" : undefined} />
        <StatTile label="Passed" value={passed.length} tone="pos" />
        <StatTile label="Failed" value={failed.length} />
      </div>

      <Panel title={`Pending ideas (${pending.length})`}>
        {pending.length ? (
          <ul className="divide-y divide-edge">
            {pending.map((idea, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm text-t1">{idea.title}</span>
                <Pill tone="warn">pending</Pill>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>No pending ideas — the research agents refill the queue.</EmptyState>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={`Passed (${passed.length})`}>
          {passed.length ? (
            <ul className="divide-y divide-edge">
              {passed.map((idea, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-sm text-t2">{idea.title}</span>
                  <Pill tone="pos">{idea.status.slice(0, 24)}</Pill>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>None yet.</EmptyState>
          )}
        </Panel>
        <Panel title={`Failed (${failed.length}) — full details in Lab Results`}>
          {failed.length ? (
            <ul className="divide-y divide-edge">
              {failed.slice(0, 20).map((idea, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-sm text-t3">{idea.title}</span>
                  <Pill tone="neg">fail</Pill>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>None in the active backlog (failures archive weekly).</EmptyState>
          )}
        </Panel>
      </div>

      {other.length ? (
        <Panel title={`Other (${other.length})`}>
          <ul className="divide-y divide-edge">
            {other.map((idea, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm text-t3">{idea.title}</span>
                <Pill tone="muted">{idea.status.slice(0, 24)}</Pill>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
