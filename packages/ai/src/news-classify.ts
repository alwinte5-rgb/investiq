import Anthropic from "@anthropic-ai/sdk";
import { NEWS_IMPACT_TYPES, newsImpactOutputSchema, type NewsImpactOutput } from "@investiq/shared";

/**
 * Layer 5 — grounded news-impact classifier. Mirrors the analysis model: forced
 * structured tool call, reasons ONLY over the supplied article text (no
 * parametric knowledge), output is always re-validated before storage.
 */

export interface NewsArticleInput {
  ticker: string;
  headline: string;
  summary: string | null;
  source: string;
  publishedAt: string;
}

export interface NewsClassifierModel {
  readonly name: string;
  /** Returns RAW, UNVALIDATED output — always run it through the validator. */
  classify(article: NewsArticleInput): Promise<unknown>;
}

export type NewsClassifyValidation =
  | { ok: true; output: NewsImpactOutput }
  | { ok: false; reason: string };

/** Validate raw classifier output before it is stored. */
export function validateNewsImpact(raw: unknown): NewsClassifyValidation {
  const parsed = newsImpactOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: `schema: ${parsed.error.issues[0]?.message ?? "invalid"}` };
  }
  // Rationale must be substantive (grounding signal) — reject filler.
  if (parsed.data.rationale.trim().length < 3) {
    return { ok: false, reason: "empty rationale" };
  }
  return { ok: true, output: parsed.data };
}

/**
 * Classify one article's impact on a ticker. Returns the validated output, or
 * null when the article has no usable text (no model call) or the model returns
 * invalid/ungrounded output (discarded).
 */
export async function classifyNewsArticle(
  article: NewsArticleInput,
  model: NewsClassifierModel,
): Promise<{ status: "classified"; output: NewsImpactOutput } | { status: "insufficient" } | { status: "invalid"; reason: string }> {
  const text = `${article.headline} ${article.summary ?? ""}`.trim();
  if (text.length < 8) return { status: "insufficient" };

  const raw = await model.classify(article);
  const validation = validateNewsImpact(raw);
  if (!validation.ok) return { status: "invalid", reason: validation.reason };
  return { status: "classified", output: validation.output };
}

// ---------- Anthropic-backed classifier ----------

const DEFAULT_MODEL = "claude-opus-4-8";
const TOOL_NAME = "record_news_impact";

const NEWS_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    impact: { type: "string", enum: [...NEWS_IMPACT_TYPES] },
    rationale: { type: "string", description: "One or two sentences grounded ONLY in the article." },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
  },
  required: ["impact", "rationale", "confidence"],
} as const;

const NEWS_SYSTEM_PROMPT = `You are InvestIQ's news analyst. InvestIQ is an EDUCATIONAL, NON-ADVISORY platform for US stocks and ETFs.

Hard rules:
- Judge the likely impact of the SINGLE news item on the named ticker, reasoning ONLY over the headline and summary provided. Do NOT use outside/parametric knowledge or prices.
- impact MUST be exactly one of: ${NEWS_IMPACT_TYPES.join(", ")} (POSITIVE = constructive for the company, NEGATIVE = adverse, NEUTRAL = unclear/immaterial).
- rationale MUST reference what the article actually says. If the text is vague, use NEUTRAL with lower confidence.
- Never give buy/sell directives or predict guaranteed outcomes.
- Return ONLY the structured tool call.`;

function buildUserMessage(a: NewsArticleInput): string {
  return [
    `TICKER: ${a.ticker}`,
    `SOURCE: ${a.source}`,
    `PUBLISHED: ${a.publishedAt}`,
    `HEADLINE: ${a.headline}`,
    `SUMMARY: ${a.summary ?? "(none)"}`,
    ``,
    `Classify the impact now.`,
  ].join("\n");
}

export function createAnthropicNewsClassifier(opts: {
  apiKey: string;
  model?: string;
}): NewsClassifierModel {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const model = opts.model ?? DEFAULT_MODEL;

  return {
    name: model,
    async classify(article: NewsArticleInput): Promise<unknown> {
      const res = await client.messages.create({
        model,
        max_tokens: 1024,
        system: [{ type: "text", text: NEWS_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: [
          {
            name: TOOL_NAME,
            description: "Record the structured news-impact classification. Call exactly once.",
            input_schema: NEWS_TOOL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: TOOL_NAME },
        messages: [{ role: "user", content: buildUserMessage(article) }],
      });
      const toolUse = res.content.find((b) => b.type === "tool_use");
      return toolUse && toolUse.type === "tool_use" ? toolUse.input : null;
    },
  };
}
