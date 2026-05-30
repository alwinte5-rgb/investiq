import { describe, it, expect } from "vitest";
import { validateAnalysisOutput } from "./validator.js";
import { checkBundleSufficiency, type EvidenceBundle } from "./evidence.js";
import { INSUFFICIENT_DATA_MESSAGE } from "@investiq/shared";

const bundle: EvidenceBundle = {
  ticker: "AAPL",
  data: [
    { ref: "price:AAPL:close", sourceType: "PRICE", value: 190.1 },
    { ref: "news:n1", sourceType: "NEWS", value: "Supplier deal announced" },
    { ref: "fund:AAPL:pe", sourceType: "FUNDAMENTAL", value: 28.4 },
  ],
};

const validOutput = {
  recommendationType: "BUY_WATCH",
  summary: "Momentum and fundamentals look constructive based on the evidence.",
  bullCase: "Supplier deal may support revenue.",
  bearCase: "Valuation is elevated relative to peers.",
  keyRisks: "Macro and concentration risk.",
  newsImpactSummary: "Recent supplier news is mildly positive.",
  technicalSummary: "Price holding above recent close.",
  confidenceScore: 62,
  riskScore: 48,
  evidence: [
    { sourceType: "PRICE", reference: "price:AAPL:close", role: "SUPPORTING", note: "Holding 190." },
    { sourceType: "FUNDAMENTAL", reference: "fund:AAPL:pe", role: "INVALIDATING", note: "PE elevated." },
  ],
};

describe("checkBundleSufficiency", () => {
  it("passes when required source types present", () => {
    expect(checkBundleSufficiency(bundle).ok).toBe(true);
  });

  it("fails with the exact message when a required source is missing", () => {
    const thin: EvidenceBundle = { ticker: "AAPL", data: [bundle.data[0]!] };
    const res = checkBundleSufficiency(thin);
    expect(res.ok).toBe(false);
    expect(res.message).toBe(INSUFFICIENT_DATA_MESSAGE);
    expect(res.missing).toContain("NEWS");
  });
});

describe("validateAnalysisOutput", () => {
  it("accepts grounded, non-directive output", () => {
    const res = validateAnalysisOutput(validOutput, bundle);
    expect(res.ok).toBe(true);
  });

  it("rejects an invalid recommendation type", () => {
    const res = validateAnalysisOutput({ ...validOutput, recommendationType: "BUY" }, bundle);
    expect(res.ok).toBe(false);
  });

  it("rejects forbidden directive language", () => {
    const bad = { ...validOutput, summary: "You should buy this now." };
    const res = validateAnalysisOutput(bad, bundle);
    expect(res.ok).toBe(false);
  });

  it("rejects ungrounded evidence references", () => {
    const bad = {
      ...validOutput,
      evidence: [
        { sourceType: "PRICE", reference: "price:FAKE:close", role: "SUPPORTING", note: "x" },
      ],
    };
    const res = validateAnalysisOutput(bad, bundle);
    expect(res.ok).toBe(false);
  });
});
