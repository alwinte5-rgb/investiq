import { describe, it, expect } from "vitest";
import { AppError, errors, toApiError } from "./errors.js";

describe("toApiError", () => {
  it("maps AppError to its code + status", () => {
    const { body, status } = toApiError(errors.forbidden());
    expect(status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("maps an UpstreamError (matched by name) to 502 UPSTREAM_UNAVAILABLE", () => {
    const e = new Error("vendor down");
    e.name = "UpstreamError";
    const { body, status } = toApiError(e);
    expect(status).toBe(502);
    expect(body.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("maps unknown errors to a safe 500 without leaking the message", () => {
    const { body, status } = toApiError(new Error("secret stack detail"));
    expect(status).toBe(500);
    expect(body.code).toBe("INTERNAL");
    expect(body.error).not.toContain("secret stack detail");
  });

  it("AppError carries httpStatus", () => {
    expect(new AppError("VALIDATION", "x", 400).httpStatus).toBe(400);
  });
});
