import { z } from "zod";
import { NEWS_IMPACT_TYPES } from "../news.js";

/**
 * Shape the news-classifier model MUST return for one (article, ticker) pair.
 * The output validator additionally rejects empty rationale and confirms the
 * impact enum — ungrounded/invalid output is discarded, never stored.
 */
export const newsImpactOutputSchema = z.object({
  impact: z.enum(NEWS_IMPACT_TYPES),
  rationale: z.string().min(1),
  confidence: z.number().int().min(0).max(100),
});

export type NewsImpactOutput = z.infer<typeof newsImpactOutputSchema>;

/** Route param/query: a ticker news refresh accepts no body; this guards query. */
export const newsRefreshQuerySchema = z.object({}).strict();
