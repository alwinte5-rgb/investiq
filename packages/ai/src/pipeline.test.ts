import { describe, it, expect, vi } from "vitest";
import { INSUFFICIENT_DATA_MESSAGE } from "@investiq/shared";
import { runAnalysis, type AnalysisPorts } from "./pipeline.js";
import type { EvidenceBundle } from "./evidence.js";
import type { AnalysisModel } from "./model.js";

const fullBundle: EvidenceBundle = {
  ticker: "AAPL",
  data: [
    { ref: "price:AAPL:quote", sourceType: "PRICE", value: { price: 190 } },
    { ref: "news:n1", sourceType: "NEWS", value: { headline: "Supplier deal" } },
    { ref: "fund:AAPL:profile", sourceType: "FUNDAMENTAL", value: { pe: 28 } },
  ],
};

const validOutput = {
  recommendationType: "BUY_WATCH",
  summary: "Constructive setup based on the evidence.",
  bullCase: "Supplier deal may support revenue.",
  bearCase: "Valuation elevated.",
  keyRisks: "Macro risk.",
  newsImpactSummary: "Mildly positive.",
  technicalSummary: "Holding above close.",
  confidenceScore: 60,
  riskScore: 45,
  evidence: [
    { sourceType: "PRICE", reference: "price:AAPL:quote", role: "SUPPORTING", note: "Holding 190." },
  ],
};

/** A model whose generate() must NOT be called in the no-call cases. */
function fakeModel(output: unknown): AnalysisModel & { generate: ReturnType<typeof vi.fn> } {
  return { name: "test-model", generate: vi.fn(async () => output) };
}

function fakePorts(over: Partial<AnalysisPorts<{ id: string }>> = {}): AnalysisPorts<{ id: string }> & {
  loadCached: ReturnType<typeof vi.fn>;
  quotaOk: ReturnType<typeof vi.fn>;
  persist: ReturnType<typeof vi.fn>;
} {
  return {
    loadCached: vi.fn(async () => null),
    quotaOk: vi.fn(async () => true),
    persist: vi.fn(async () => ({ id: "a1" })),
    ...over,
  } as never;
}

describe("runAnalysis pipeline", () => {
  it("incomplete bundle → insufficient, exact message, NO model call, NO quota use", async () => {
    const thin: EvidenceBundle = { ticker: "AAPL", data: [fullBundle.data[0]!] }; // PRICE only
    const model = fakeModel(validOutput);
    const ports = fakePorts();

    const res = await runAnalysis(thin, model, ports);

    expect(res.status).toBe("insufficient");
    if (res.status === "insufficient") {
      expect(res.message).toBe(INSUFFICIENT_DATA_MESSAGE);
      expect(res.missing).toEqual(expect.arrayContaining(["NEWS", "FUNDAMENTAL"]));
    }
    expect(model.generate).not.toHaveBeenCalled();
    expect(ports.quotaOk).not.toHaveBeenCalled();
    expect(ports.persist).not.toHaveBeenCalled();
  });

  it("cache hit → cached, NO model call, NO quota check, NO persist", async () => {
    const model = fakeModel(validOutput);
    const ports = fakePorts({ loadCached: vi.fn(async () => ({ id: "cached" })) });

    const res = await runAnalysis(fullBundle, model, ports);

    expect(res.status).toBe("cached");
    if (res.status === "cached") expect(res.analysis).toEqual({ id: "cached" });
    expect(model.generate).not.toHaveBeenCalled();
    expect(ports.quotaOk).not.toHaveBeenCalled();
    expect(ports.persist).not.toHaveBeenCalled();
  });

  it("over quota → quota_exceeded BEFORE any model call", async () => {
    const model = fakeModel(validOutput);
    const ports = fakePorts({ quotaOk: vi.fn(async () => false) });

    const res = await runAnalysis(fullBundle, model, ports);

    expect(res.status).toBe("quota_exceeded");
    expect(model.generate).not.toHaveBeenCalled();
    expect(ports.persist).not.toHaveBeenCalled();
  });

  it("ungrounded/invalid output → invalid_output, discarded (NO persist)", async () => {
    const bad = {
      ...validOutput,
      evidence: [{ sourceType: "PRICE", reference: "price:FAKE:quote", role: "SUPPORTING", note: "x" }],
    };
    const model = fakeModel(bad);
    const ports = fakePorts();

    const res = await runAnalysis(fullBundle, model, ports);

    expect(res.status).toBe("invalid_output");
    expect(model.generate).toHaveBeenCalledTimes(1);
    expect(ports.persist).not.toHaveBeenCalled();
  });

  it("happy path → created, persists exactly once with the validated output", async () => {
    const model = fakeModel(validOutput);
    const ports = fakePorts();

    const res = await runAnalysis(fullBundle, model, ports);

    expect(res.status).toBe("created");
    if (res.status === "created") expect(res.analysis).toEqual({ id: "a1" });
    expect(model.generate).toHaveBeenCalledTimes(1);
    expect(ports.persist).toHaveBeenCalledTimes(1);
    const arg = (ports.persist as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(arg.output.recommendationType).toBe("BUY_WATCH");
    expect(arg.model).toBe("test-model");
    expect(typeof arg.inputsHash).toBe("string");
  });
});
