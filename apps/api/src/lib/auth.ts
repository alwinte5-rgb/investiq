import { entitlementsFor, errors, type Entitlements } from "@investiq/shared";

/**
 * Authentication — STEP 1 of the request pipeline. Verifies the caller
 * server-side and resolves the InvestIQ user. Never trust client-supplied
 * identity. Clerk is the source of truth for auth; the User row mirrors it.
 *
 * NOTE: the actual Clerk token verification is wired in Layer 1 (via
 * @clerk/backend). This module defines the contract and the find-or-provision
 * step so routes can depend on a stable AuthContext today.
 */
export interface AuthContext {
  userId: string; // InvestIQ User.id
  clerkId: string;
  plan: "FREE" | "INVESTOR" | "INVESTOR_PLUS";
  role: "USER" | "ADMIN";
}

/** Verifies a bearer token with Clerk and returns the verified clerkId. */
export interface ClerkVerifier {
  verify(token: string | undefined): Promise<{ clerkId: string } | null>;
}

/** Loads/provisions the InvestIQ user for a verified clerkId. */
export interface UserLoader {
  byClerkId(clerkId: string): Promise<AuthContext | null>;
}

/**
 * Resolve an AuthContext from the Authorization header, or throw UNAUTHORIZED.
 * Routes call this first; everything after assumes a verified user.
 */
export async function authenticate(
  authorizationHeader: string | undefined,
  verifier: ClerkVerifier,
  users: UserLoader,
): Promise<AuthContext> {
  const token = authorizationHeader?.replace(/^Bearer\s+/i, "");
  const verified = await verifier.verify(token);
  if (!verified) throw errors.unauthorized();

  const ctx = await users.byClerkId(verified.clerkId);
  if (!ctx) throw errors.unauthorized("User not provisioned");
  return ctx;
}

/** Require ADMIN role (used by /admin/* routes), after authenticate(). */
export function requireAdmin(ctx: AuthContext): void {
  if (ctx.role !== "ADMIN") throw errors.forbidden("Admin access required");
}

/**
 * Review mode: plan gating is OFF unless PLAN_GATING_ENABLED=true. While off,
 * every authenticated user is treated as the top tier so all features are
 * reachable for review. The pricing tiers + entitlement matrix stay fully
 * defined — flip the flag to re-enable enforcement once pricing is finalized.
 * Read directly from process.env (not the validated env) so this stays usable
 * from the auth layer without loading the full server env.
 */
export function planGatingEnabled(): boolean {
  return process.env.PLAN_GATING_ENABLED === "true";
}

/** The plan to enforce: the user's real plan when gating is on, else the top
 * tier (ungated review mode). Applied where the AuthContext is built so it
 * covers both API entitlement checks and the plan reported to clients. */
export function effectivePlan(plan: AuthContext["plan"]): AuthContext["plan"] {
  return planGatingEnabled() ? plan : "INVESTOR_PLUS";
}

/**
 * Require a boolean plan entitlement (e.g. portfolioIntelligence, newsIntelligence).
 * Centralized so every gated feature enforces access the same way, server-side.
 */
export function requireEntitlement(
  plan: AuthContext["plan"],
  key: { [K in keyof Entitlements]: Entitlements[K] extends boolean ? K : never }[keyof Entitlements],
  label: string,
): void {
  if (!entitlementsFor(plan)[key]) {
    throw errors.forbidden(`${label} requires the Investor plan or higher.`);
  }
}
