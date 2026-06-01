import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret } from "./crypto.js";

const KEY = "0123456789012345678901234567890123";

describe("crypto", () => {
  it("round-trips a secret", () => {
    const secret = "snaptrade-user-secret-xyz";
    const enc = encryptSecret(secret, KEY);
    expect(enc).not.toContain(secret);
    expect(decryptSecret(enc, KEY)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    expect(encryptSecret("x", KEY)).not.toBe(encryptSecret("x", KEY));
  });

  it("fails to decrypt with the wrong key", () => {
    const enc = encryptSecret("secret", KEY);
    expect(() => decryptSecret(enc, "wrong-key-wrong-key-wrong-key-1234")).toThrow();
  });

  it("rejects a tampered payload", () => {
    const enc = encryptSecret("secret", KEY);
    const tampered = enc.slice(0, -4) + "AAAA";
    expect(() => decryptSecret(tampered, KEY)).toThrow();
  });
});
