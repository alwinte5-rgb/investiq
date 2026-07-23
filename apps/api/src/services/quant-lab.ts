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
