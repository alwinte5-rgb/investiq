import { describe, it, expect } from "vitest";
import {
  validateNewsImpact,
  classifyNewsArticle,
  type NewsArticleInput,
  type NewsClassifierModel,
} from "./news-classify.js";

const article: NewsArticleInput = {
  ticker: "AAPL",
  headline: "Apple beats earnings expectations on strong iPhone sales",
  summary: "Revenue and EPS came in above consensus.",
  source: "benzinga",
  publishedAt: "2026-06-01T12:00:00Z",
};

function fakeModel(output: unknown): NewsClassifierModel {
  return { name: "fake", classify: async () => output };
}

describe("validateNewsImpact", () => {
  it("accepts a well-formed classification", () => {
    const r = validateNewsImpact({ impact: "POSITIVE", rationale: "Beat consensus.", confidence: 80 });
    expect(r.ok).toBe(true);
  });

  it("rejects an invalid impact enum", () => {
    const r = validateNewsImpact({ impact: "BULLISH", rationale: "x y z", confidence: 50 });
    expect(r.ok).toBe(false);
  });

  it("rejects empty/filler rationale", () => {
    const r = validateNewsImpact({ impact: "NEUTRAL", rationale: " ", confidence: 50 });
    expect(r.ok).toBe(false);
  });

  it("rejects out-of-range confidence", () => {
    const r = validateNewsImpact({ impact: "NEGATIVE", rationale: "Bad news.", confidence: 140 });
    expect(r.ok).toBe(false);
  });
});

describe("classifyNewsArticle", () => {
  it("classifies a valid article via the model", async () => {
    const model = fakeModel({ impact: "POSITIVE", rationale: "Beat consensus on iPhone sales.", confidence: 78 });
    const r = await classifyNewsArticle(article, model);
    expect(r.status).toBe("classified");
    if (r.status === "classified") {
      expect(r.output.impact).toBe("POSITIVE");
      expect(r.output.confidence).toBe(78);
    }
  });

  it("returns insufficient (no model call) for an empty article", async () => {
    let called = false;
    const model: NewsClassifierModel = {
      name: "fake",
      classify: async () => {
        called = true;
        return {};
      },
    };
    const r = await classifyNewsArticle({ ...article, headline: "x", summary: null }, model);
    expect(r.status).toBe("insufficient");
    expect(called).toBe(false);
  });

  it("discards invalid model output", async () => {
    const r = await classifyNewsArticle(article, fakeModel({ impact: "MOON", rationale: "", confidence: 0 }));
    expect(r.status).toBe("invalid");
  });
});
