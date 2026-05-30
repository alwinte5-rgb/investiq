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
    },
  });
}

export async function getUserByClerkId(clerkId: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { clerkId } });
}

export async function deleteUserByClerkId(clerkId: string): Promise<void> {
  await prisma.user.deleteMany({ where: { clerkId } });
}

export type { Plan, Role, User };
