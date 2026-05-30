import type { FastifyRequest } from "fastify";
import type { ClerkClient } from "@clerk/backend";
import { errors } from "@investiq/shared";
import { findOrProvisionUser } from "@investiq/db";
import { authenticate, type AuthContext, type ClerkVerifier } from "./auth.js";
import { userLoader } from "./context.js";

export interface AuthDeps {
  verifier: ClerkVerifier;
  clerk: ClerkClient;
}

/**
 * Single entry point for STEP 1 (authentication) used by every protected
 * route and by /me. Verifies the token, loads the mirrored user, and lazily
 * provisions the User row if the Clerk webhook hasn't created it yet. Throws
 * UNAUTHORIZED on any failure. Centralized so the lazy-provision logic is not
 * duplicated across routes.
 */
export async function resolveAuthContext(
  req: FastifyRequest,
  deps: AuthDeps,
): Promise<AuthContext> {
  try {
    return await authenticate(req.headers.authorization, deps.verifier, userLoader);
  } catch (err) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const verified = await deps.verifier.verify(token);
    if (!verified) throw err;

    const cu = await deps.clerk.users.getUser(verified.clerkId);
    const email = cu.primaryEmailAddress?.emailAddress ?? cu.emailAddresses[0]?.emailAddress;
    if (!email) throw errors.unauthorized("No email on account");

    const user = await findOrProvisionUser({
      clerkId: verified.clerkId,
      email,
      name: [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null,
      avatarUrl: cu.imageUrl ?? null,
    });
    return { userId: user.id, clerkId: user.clerkId, plan: user.plan, role: user.role };
  }
}
