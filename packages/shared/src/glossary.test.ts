import { describe, it, expect } from "vitest";
import { RECOMMENDATION_TYPES } from "./recommendations.js";
import {
  GLOSSARY,
  glossaryTerms,
  lookupTerm,
  normalizeTermKey,
  recommendationTypesWithGlossary,
} from "./glossary.js";

describe("glossary", () => {
  it("has a non-trivial, well-formed library", () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(30);
    for (const t of GLOSSARY) {
      expect(t.term.trim().length).toBeGreaterThan(0);
      expect(t.keys.length).toBeGreaterThan(0);
      // short definitions stay readable at a glance
      expect(t.short.trim().length).toBeGreaterThan(0);
      expect(t.short.length).toBeLessThanOrEqual(220);
    }
  });

  it("uses unique display terms", () => {
    const terms = GLOSSARY.map((t) => t.term);
    expect(new Set(terms).size).toBe(terms.length);
  });

  it("has no colliding normalized keys across different terms", () => {
    const seen = new Map<string, string>();
    for (const entry of GLOSSARY) {
      for (const key of [entry.term, ...entry.keys]) {
        const norm = normalizeTermKey(key);
        const prior = seen.get(norm);
        // Same key must never resolve to two different terms.
        if (prior) expect(prior).toBe(entry.term);
        seen.set(norm, entry.term);
      }
    }
  });

  it("looks up terms by label, synonym, and abbreviation, ignoring case/punctuation", () => {
    expect(lookupTerm("P/E")?.term).toBe("P/E Ratio");
    expect(lookupTerm("pe ratio")?.term).toBe("P/E Ratio");
    expect(lookupTerm("price to earnings")?.term).toBe("P/E Ratio");
    expect(lookupTerm("Stop Loss")?.term).toBe("Stop Loss");
    expect(lookupTerm("r:r")?.term).toBe("Reward : Risk");
    expect(lookupTerm("  Buy   Zone ")?.term).toBe("Buy Zone");
  });

  it("returns undefined for unknown terms", () => {
    expect(lookupTerm("definitely-not-a-real-term")).toBeUndefined();
    expect(lookupTerm("")).toBeUndefined();
  });

  it("defines every recommendation type (looked up by enum value)", () => {
    for (const rt of RECOMMENDATION_TYPES) {
      expect(lookupTerm(rt), `missing glossary entry for ${rt}`).toBeDefined();
    }
    expect(recommendationTypesWithGlossary().length).toBe(RECOMMENDATION_TYPES.length);
  });

  it("exposes the full library via glossaryTerms()", () => {
    expect(glossaryTerms()).toBe(GLOSSARY);
  });
});
