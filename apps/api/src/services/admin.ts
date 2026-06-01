import { prisma } from "@investiq/db";
import type { Plan, Role } from "@investiq/db";

/**
 * Admin business logic. Every mutation writes an AuditLog entry (actor, action,
 * target). Callers must have already passed requireAdmin().
 */

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      role: true,
      createdAt: true,
      _count: { select: { watchlists: true, brokerageConnections: true } },
    },
  });
}

export async function updateUser(
  actorUserId: string,
  targetId: string,
  patch: { plan?: Plan; role?: Role },
) {
  const before = await prisma.user.findUnique({
    where: { id: targetId },
    select: { plan: true, role: true },
  });
  const user = await prisma.user.update({
    where: { id: targetId },
    data: patch,
    select: { id: true, email: true, plan: true, role: true },
  });
  await prisma.auditLog.create({
    data: {
      actorUserId,
      action: "user.update",
      targetType: "User",
      targetId,
      metadata: { before, after: patch },
    },
  });
  return user;
}

export async function listFlags() {
  return prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
}

export async function upsertFlag(
  actorUserId: string,
  key: string,
  patch: { enabled: boolean; rolloutPct?: number },
) {
  const flag = await prisma.featureFlag.upsert({
    where: { key },
    update: { enabled: patch.enabled, ...(patch.rolloutPct != null ? { rolloutPct: patch.rolloutPct } : {}) },
    create: { key, enabled: patch.enabled, rolloutPct: patch.rolloutPct ?? 0 },
  });
  await prisma.auditLog.create({
    data: { actorUserId, action: "flag.upsert", targetType: "FeatureFlag", targetId: key, metadata: patch },
  });
  return flag;
}

export async function listAuditLogs() {
  return prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

export async function listApiHealth() {
  return prisma.apiHealthSnapshot.findMany({ orderBy: { windowStart: "desc" }, take: 50 });
}

export async function adminOverview() {
  const [users, free, investor, plus, connections, watchlists] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { plan: "FREE" } }),
    prisma.user.count({ where: { plan: "INVESTOR" } }),
    prisma.user.count({ where: { plan: "INVESTOR_PLUS" } }),
    prisma.brokerageConnection.count(),
    prisma.watchlist.count(),
  ]);
  return { users, plans: { FREE: free, INVESTOR: investor, INVESTOR_PLUS: plus }, connections, watchlists };
}
