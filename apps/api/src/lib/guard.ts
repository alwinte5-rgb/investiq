import type { FastifyRequest } from "fastify";
import type { ClerkClient } from "@clerk/backend";
import { AppError, errors } from "@investiq/shared";
import { findOrProvisionUser, touchUserLastSeen } from "@investiq/db";
import { authenticate, effectivePlan, type AuthContext, type ClerkVerifier } from "./auth.js";
import { userLoader } from "./context.js";

export interface AuthDeps {
  verifier: ClerkVerifier;
  clerk: ClerkClient;
}

/** Fire-and-forget activity heartbeat (throttled in the repo). Never blocks or
 *  fails a request — a heartbeat write error must not break authentication. */
function markActive(userId: string): void {
  void touchUserLastSeen(userId).catch(() => {});
}

/**
 * TEMPORARY guest mode (GUEST_MODE=true): requests without a bearer token are
 * served as one shared, lazily provisioned guest user so the app can be used
 * without signing in. Everyone shares the guest's settings/plans/journal, so
 * this is strictly for demo/review periods — unset the env var to restore
 * normal auth. Admin routes stay safe: the guest's role is USER, so
 * requireAdmin still rejects. Requests WITH a token authenticate normally.
 */
async function guestContext(): Promise<AuthContext> {
  const user = await findOrProvisionUser({
    clerkId: "guest-mode",
    email: "guest@investiq.local",
    name: "Guest",
    avatarUrl: null,
  });
  markActive(user.id);
  return { userId: user.id, clerkId: user.clerkId, plan: effectivePlan(user.plan), role: "USER" };
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
  if (process.env.GUEST_MODE === "true" && !req.headers.authorization) {
    return guestContext();
  }
  try {
    const ctx = await authenticate(req.headers.authorization, deps.verifier, userLoader);
    markActive(ctx.userId);
    return ctx;
  } catch (err) {
    // Only lazily provision for the specific "valid token, missing user row"
    // case. Re-throw invalid-token (401) and any unrelated error (e.g. a DB
    // failure) instead of swallowing it and re-verifying.
    if (!(err instanceof AppError) || err.message !== "User not provisioned") throw err;

    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const verified = await deps.verifier.verify(token);
    if (!verified) throw errors.unauthorized();

    const cu = await deps.clerk.users.getUser(verified.clerkId);
    const email = cu.primaryEmailAddress?.emailAddress ?? cu.emailAddresses[0]?.emailAddress;
    if (!email) throw errors.unauthorized("No email on account");

    const user = await findOrProvisionUser({
      clerkId: verified.clerkId,
      email,
      name: [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null,
      avatarUrl: cu.imageUrl ?? null,
    });
    markActive(user.id);
    return { userId: user.id, clerkId: user.clerkId, plan: effectivePlan(user.plan), role: user.role };
  }
}
