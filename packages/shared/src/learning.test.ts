import { describe, expect, it } from "vitest";
import { RECOMMENDATION_TYPES } from "./recommendations.js";
import {
  LEARNING_CONTENT,
  RECOMMENDATION_LEARNING,
  RISK_LEARNING_SLUGS,
  learningBySlug,
  learningForRecommendation,
  learningForRisk,
  recommendationsWithLearning,
} from "./learning.js";

describe("learning content", () => {
  it("has unique slugs", () => {
    const slugs = LEARNING_CONTENT.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every content entry has a title, non-trivial body, and tags", () => {
    for (const c of LEARNING_CONTENT) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.body.length).toBeGreaterThan(40);
      expect(c.tags.length).toBeGreaterThan(0);
    }
  });
});

describe("recommendation links", () => {
  it("maps every recommendation type to at least one learning item", () => {
    for (const t of RECOMMENDATION_TYPES) {
      expect(learningForRecommendation(t).length).toBeGreaterThan(0);
    }
    expect(recommendationsWithLearning().length).toBe(RECOMMENDATION_TYPES.length);
  });

  it("every mapped slug resolves to existing content", () => {
    for (const slugs of Object.values(RECOMMENDATION_LEARNING)) {
      for (const slug of slugs) {
        expect(learningBySlug(slug), `missing content for ${slug}`).toBeDefined();
      }
    }
  });

  it("does not duplicate slugs within a single recommendation type", () => {
    for (const slugs of Object.values(RECOMMENDATION_LEARNING)) {
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("returns an empty list for an unknown recommendation type", () => {
    expect(learningForRecommendation("NOT_A_TYPE")).toEqual([]);
  });
});

describe("risk links", () => {
  it("all risk slugs resolve and risk learning is non-empty", () => {
    for (const slug of RISK_LEARNING_SLUGS) {
      expect(learningBySlug(slug), `missing content for ${slug}`).toBeDefined();
    }
    expect(learningForRisk().length).toBe(RISK_LEARNING_SLUGS.length);
  });
});
