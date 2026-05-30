import type { ClerkVerifier, UserLoader } from "./auth.js";

/**
 * Wiring point for auth dependencies. Real Clerk verification + DB-backed user
 * loading are implemented in Layer 1. Until then these return null so the API
 * boots and honestly responds 401 on protected routes (no fake auth).
 */
export const clerkVerifier: ClerkVerifier = {
  async verify(_token) {
    // TODO(Layer 1): verify with @clerk/backend using CLERK_SECRET_KEY.
    return null;
  },
};

export const userLoader: UserLoader = {
  async byClerkId(_clerkId) {
    // TODO(Layer 1): find-or-provision User via @investiq/db.
    return null;
  },
};
