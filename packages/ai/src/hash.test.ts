import { describe, it, expect } from "vitest";
import { computeInputsHash } from "./hash.js";
import type { EvidenceBundle } from "./evidence.js";

const base: EvidenceBundle = {
  ticker: "AAPL",
  data: [
    { ref: "price:AAPL:quote", sourceType: "PRICE", value: { price: 190 } },
    { ref: "news:n1", sourceType: "NEWS", value: { headline: "Deal" } },
  ],
};

describe("computeInputsHash", () => {
  it("is stable regardless of data ordering", () => {
    const reordered: EvidenceBundle = { ticker: "AAPL", data: [base.data[1]!, base.data[0]!] };
    expect(computeInputsHash(base, "m1")).toBe(computeInputsHash(reordered, "m1"));
  });

  it("changes when a value changes (regeneration trigger)", () => {
    const changed: EvidenceBundle = {
      ticker: "AAPL",
      data: [{ ...base.data[0]!, value: { price: 191 } }, base.data[1]!],
    };
    expect(computeInputsHash(base, "m1")).not.toBe(computeInputsHash(changed, "m1"));
  });

  it("changes when the model changes", () => {
    expect(computeInputsHash(base, "m1")).not.toBe(computeInputsHash(base, "m2"));
  });

  it("is case-insensitive on the ticker", () => {
    const lower: EvidenceBundle = { ...base, ticker: "aapl" };
    expect(computeInputsHash(base, "m1")).toBe(computeInputsHash(lower, "m1"));
  });
});
