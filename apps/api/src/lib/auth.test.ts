import { describe, it, expect, afterEach } from "vitest";
import { AppError, type Plan } from "@investiq/shared";
import { effectivePlan, requireAdmin, requireEntitlement, type AuthContext } from "./auth.js";

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

describe("effectivePlan (review-mode ungating)", () => {
  afterEach(() => {
    delete process.env.PLAN_GATING_ENABLED;
  });

  it("returns the top tier for any plan when gating is OFF (default)", () => {
    delete process.env.PLAN_GATING_ENABLED;
    expect(effectivePlan("FREE")).toBe("INVESTOR_PLUS");
    expect(effectivePlan("INVESTOR")).toBe("INVESTOR_PLUS");
  });

  it("preserves the real plan when PLAN_GATING_ENABLED=true", () => {
    process.env.PLAN_GATING_ENABLED = "true";
    expect(effectivePlan("FREE")).toBe("FREE");
    expect(effectivePlan("INVESTOR")).toBe("INVESTOR");
  });
});

describe("requireEntitlement (portfolioIntelligence)", () => {
  const gate = (plan: Plan) => requireEntitlement(plan, "portfolioIntelligence", "Portfolio Intelligence");

  it("allows INVESTOR and INVESTOR_PLUS", () => {
    expect(() => gate("INVESTOR")).not.toThrow();
    expect(() => gate("INVESTOR_PLUS")).not.toThrow();
  });

  it("forbids FREE with FORBIDDEN/403 and an upgrade message", () => {
    try {
      gate("FREE");
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as AppError).code).toBe("FORBIDDEN");
      expect((e as AppError).httpStatus).toBe(403);
      expect((e as AppError).message).toMatch(/Investor plan/);
    }
  });
});
