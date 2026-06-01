import { describe, it, expect } from "vitest";
import { AppError } from "@investiq/shared";
import { requireAdmin, type AuthContext } from "./auth.js";

const ctx = (role: "USER" | "ADMIN"): AuthContext => ({
  userId: "u1",
  clerkId: "c1",
  plan: "FREE",
  role,
});

describe("requireAdmin", () => {
  it("allows ADMIN", () => {
    expect(() => requireAdmin(ctx("ADMIN"))).not.toThrow();
  });
  it("forbids USER with FORBIDDEN/403", () => {
    try {
      requireAdmin(ctx("USER"));
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as AppError).code).toBe("FORBIDDEN");
      expect((e as AppError).httpStatus).toBe(403);
    }
  });
});
