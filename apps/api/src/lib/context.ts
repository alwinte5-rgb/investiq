import { createClerkClient, verifyToken } from "@clerk/backend";
import { getUserByClerkId } from "@investiq/db";
import type { AuthContext, ClerkVerifier, UserLoader } from "./auth.js";

/**
 * Real auth wiring.
 * - clerkVerifier verifies the bearer token server-side via Clerk.
 * - userLoader loads the mirrored InvestIQ user (provisioned by the Clerk
 *   webhook, or lazily on first authenticated request) and returns plan/role.
 */
export function makeClerkVerifier(secretKey: string): ClerkVerifier {
  return {
    async verify(token) {
      if (!token) return null;
      try {
        const claims = await verifyToken(token, { secretKey });
        return claims?.sub ? { clerkId: claims.sub } : null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Loads the app user for a verified clerkId. If the webhook hasn't created the
 * row yet, the route layer may lazily provision (see auth flow); here we read
 * what exists and surface plan/role for entitlement checks.
 */
export const userLoader: UserLoader = {
  async byClerkId(clerkId) {
    const user = await getUserByClerkId(clerkId);
    if (!user) return null;
    const ctx: AuthContext = {
      userId: user.id,
      clerkId: user.clerkId,
      plan: user.plan,
      role: user.role,
    };
    return ctx;
  },
};

export function makeClerkClient(secretKey: string) {
  return createClerkClient({ secretKey });
}
