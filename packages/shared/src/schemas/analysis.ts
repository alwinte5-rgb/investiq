import { z } from "zod";
import { RECOMMENDATION_TYPES } from "../recommendations.js";

/** Source categories an evidence item may come from. */
export const evidenceSourceType = z.enum([
  "PRICE",
  "NEWS",
  "EARNINGS",
  "ANALYST",
  "FUNDAMENTAL",
  "PORTFOLIO",
  "SECTOR",
]);

export const evidenceItemSchema = z.object({
  sourceType: evidenceSourceType,
  reference: z.string().min(1), // id/url into the supplied bundle
  role: z.enum(["SUPPORTING", "INVALIDATING"]),
  note: z.string().min(1),
});

/**
 * Shape the Claude model MUST return for a stock analysis. The output validator
 * additionally checks: (a) no forbidden directive tokens, (b) every evidence
 * `reference` exists in the supplied evidence bundle.
 */
export const analysisOutputSchema = z.object({
  recommendationType: z.enum(RECOMMENDATION_TYPES),
  summary: z.string().min(1),
  bullCase: z.string().min(1),
  bearCase: z.string().min(1),
  keyRisks: z.string().min(1),
  newsImpactSummary: z.string(),
  technicalSummary: z.string(),
  confidenceScore: z.number().int().min(0).max(100),
  riskScore: z.number().int().min(0).max(100),
  evidence: z.array(evidenceItemSchema).min(1),
});

export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
