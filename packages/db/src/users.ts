import { prisma } from "./index.js";
import type { Plan, Role, User } from "@prisma/client";

/**
 * User repository. Clerk is the source of truth for auth; the User row mirrors
 * it and is the source of truth for app data/entitlements. Provisioning is
 * idempotent (find-or-create) so a user is never blocked if the Clerk webhook
 * is delayed.
 */
export interface ProvisionInput {
  clerkId: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export async function findOrProvisionUser(input: ProvisionInput): Promise<User> {
  return prisma.user.upsert({
    where: { clerkId: input.clerkId },
    update: {
      email: input.email,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    },
    create: {
      clerkId: input.clerkId,
      email: input.email,
      name: input.name ?? null,
      avatarUrl: input.avatarUrl ?? null,
      // New users start on INVESTOR so the full app (portfolio intelligence,
      // reviews, news, opportunities) is usable out of the box. Set on CREATE
      // only — an admin-adjusted plan on an existing user is never overwritten.
      plan: "INVESTOR",
    },
  });
}

export async function getUserByClerkId(clerkId: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { clerkId } });
}

export async function deleteUserByClerkId(clerkId: string): Promise<void> {
  await prisma.user.deleteMany({ where: { clerkId } });
}

/** Only rewrite the heartbeat at most this often, so it's not a write/request. */
const LAST_SEEN_THROTTLE_MS = 30 * 60 * 1000; // 30m

/**
 * Best-effort "user is active" heartbeat. Conditionally bumps `lastSeenAt` only
 * when it's stale (or unset), so an authenticated request burst costs at most
 * one write per user per 30m. Safe to call fire-and-forget.
 */
export async function touchUserLastSeen(userId: string): Promise<void> {
  const threshold = new Date(Date.now() - LAST_SEEN_THROTTLE_MS);
  await prisma.user.updateMany({
    where: { id: userId, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: threshold } }] },
    data: { lastSeenAt: new Date() },
  });
}

/** Count users seen since `since` — used to gate work on real activity. */
export async function countActiveUsersSince(since: Date): Promise<number> {
  return prisma.user.count({ where: { lastSeenAt: { gte: since } } });
}

export type { Plan, Role, User };
