import { prisma } from "@investiq/db";

// Single-row bridge to ~/quant-lab's status — see schema.prisma's
// QuantLabSnapshot for why this is one fixed-id row, not per-user.
const SNAPSHOT_ID = "singleton";

export async function upsertQuantSnapshot(data: unknown): Promise<void> {
  await prisma.quantLabSnapshot.upsert({
    where: { id: SNAPSHOT_ID },
    create: { id: SNAPSHOT_ID, data: data as object },
    update: { data: data as object },
  });
}

export async function getQuantSnapshot(): Promise<{ data: unknown; updatedAt: Date } | null> {
  const row = await prisma.quantLabSnapshot.findUnique({ where: { id: SNAPSHOT_ID } });
  return row ? { data: row.data, updatedAt: row.updatedAt } : null;
}

// ---- per-bot controls (pull-based: the Mac applies what the web stores) ----

export interface BotControlPatch {
  riskPct?: number | null;
  maxExposure?: number | null;
  paperEquity?: number | null;
  stopPct?: number | null;
  takeProfit?: boolean | null;
  desiredStatus?: string | null;
}

export function listBotControls() {
  return prisma.botControl.findMany({ orderBy: { botName: "asc" } });
}

export function upsertBotControl(botName: string, patch: BotControlPatch) {
  // A new desired value invalidates the previous "applied" stamp — the UI
  // reads appliedAt == null as "pending on the Mac".
  return prisma.botControl.upsert({
    where: { botName },
    create: { botName, ...patch },
    update: { ...patch, appliedAt: null },
  });
}

/** Mark rows as applied — called by quant-lab's sync after it writes the
 * overrides and restarts the affected loops. */
export async function markControlsApplied(botNames: string[]): Promise<number> {
  if (!botNames.length) return 0;
  const { count } = await prisma.botControl.updateMany({
    where: { botName: { in: botNames } },
    data: { appliedAt: new Date() },
  });
  return count;
}
