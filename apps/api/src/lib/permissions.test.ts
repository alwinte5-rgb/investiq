import { describe, it, expect } from "vitest";
import { AppError } from "@investiq/shared";
import { assertOwnedBy } from "./permissions.js";

describe("assertOwnedBy (IDOR guard)", () => {
  it("allows the owner", () => {
    expect(() => assertOwnedBy("user-1", { userId: "user-1" })).not.toThrow();
  });

  it("forbids a different user (FORBIDDEN, not NOT_FOUND)", () => {
    try {
      assertOwnedBy("user-1", { userId: "user-2" });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("FORBIDDEN");
      expect((e as AppError).httpStatus).toBe(403);
    }
  });

  it("returns NOT_FOUND for a missing resource", () => {
    try {
      assertOwnedBy("user-1", null);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as AppError).code).toBe("NOT_FOUND");
      expect((e as AppError).httpStatus).toBe(404);
    }
  });
});
