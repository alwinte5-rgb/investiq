import { errors } from "@investiq/shared";
import type { AuthContext } from "./auth.js";

/**
 * Authorization — STEP 2 of the request pipeline. Object-level checks: user A
 * can never access user B's resource. Every user-owned resource is checked by
 * comparing its `userId` against the authenticated context. Never trust a
 * client-supplied id without an ownership check.
 */

/** A resource that belongs to a user. */
export interface OwnedResource {
  userId: string;
}

/** Throws NOT_FOUND if missing, FORBIDDEN if owned by a different user. */
export function assertOwnedBy(userId: string, resource: OwnedResource | null): void {
  if (!resource) throw errors.notFound();
  if (resource.userId !== userId) throw errors.forbidden();
}

/** Throws FORBIDDEN unless the resource belongs to the caller. */
export function assertOwner(ctx: AuthContext, resource: OwnedResource | null): void {
  assertOwnedBy(ctx.userId, resource);
}

/** Convenience for query filters: always scope reads/writes by the user. */
export function ownerScope(ctx: AuthContext): { userId: string } {
  return { userId: ctx.userId };
}
