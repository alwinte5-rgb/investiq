import Anthropic from "@anthropic-ai/sdk";
import { RECOMMENDATION_TYPES } from "@investiq/shared";
import type { EvidenceBundle } from "./evidence.js";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisUserMessage } from "./prompt.js";

/**
 * The model port the analysis pipeline depends on. `generate` returns RAW,
 * UNVALIDATED output — the pipeline always runs it through the output validator
 * (schema + grounding + forbidden-language checks) before anything is stored.
 * Tests inject a fake implementation so the pipeline can be exercised without a
 * network call or API key.
 */
export interface AnalysisModel {
  readonly name: string;
  generate(bundle: EvidenceBundle): Promise<unknown>;
}

const DEFAULT_MODEL = "claude-opus-4-8";
const TOOL_NAME = "record_analysis";

/**
 * JSON Schema the model must fill when calling the forced tool. The zod
 * `analysisOutputSchema` validator is the real gatekeeper (it re-checks this
 * plus grounding + forbidden language); this schema just shapes the model's
 * output. Kept in sync by hand — drift only affects guidance, never safety.
 */
const ANALYSIS_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    recommendationType: { type: "string", enum: [...RECOMMENDATION_TYPES] },
    summary: { type: "string" },
    bullCase: { type: "string" },
    bearCase: { type: "string" },
    keyRisks: { type: "string" },
    newsImpactSummary: { type: "string" },
    technicalSummary: { type: "string" },
    confidenceScore: { type: "integer", minimum: 0, maximum: 100 },
    riskScore: { type: "integer", minimum: 0, maximum: 100 },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          sourceType: {
            type: "string",
            enum: ["PRICE", "NEWS", "EARNINGS", "ANALYST", "FUNDAMENTAL", "PORTFOLIO", "SECTOR"],
          },
          reference: { type: "string", description: "Must be one of the provided evidence refs" },
          role: { type: "string", enum: ["SUPPORTING", "INVALIDATING"] },
          note: { type: "string" },
        },
        required: ["sourceType", "reference", "role", "note"],
      },
    },
  },
  required: [
    "recommendationType",
    "summary",
    "bullCase",
    "bearCase",
    "keyRisks",
    "newsImpactSummary",
    "technicalSummary",
    "confidenceScore",
    "riskScore",
    "evidence",
  ],
} as const;

/**
 * Anthropic-backed analysis model. Forces structured output via a single
 * required tool call, caches the static system prompt, and reasons ONLY over
 * the supplied evidence bundle (the system prompt forbids parametric knowledge;
 * the validator enforces grounding afterward).
 */
export function createAnthropicAnalysisModel(opts: {
  apiKey: string;
  model?: string;
}): AnalysisModel {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const model = opts.model ?? DEFAULT_MODEL;

  return {
    name: model,
    async generate(bundle: EvidenceBundle): Promise<unknown> {
      const res = await client.messages.create({
        model,
        max_tokens: 4096,
        system: [
          {
            type: "text",
            text: ANALYSIS_SYSTEM_PROMPT,
            // Static prefix — cache it (no-op until the prompt exceeds the
            // model's min cacheable size, harmless before then).
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [
          {
            name: TOOL_NAME,
            description: "Record the structured stock analysis. You MUST call this exactly once.",
            input_schema: ANALYSIS_TOOL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
          },
        ],
        // Force the structured tool call so the response is always the schema.
        tool_choice: { type: "tool", name: TOOL_NAME },
        messages: [{ role: "user", content: buildAnalysisUserMessage(bundle) }],
      });

      // The forced tool call's `input` is the (already-parsed) analysis object.
      // Returned raw; the pipeline validates it. null ⇒ treated as invalid.
      const toolUse = res.content.find((b) => b.type === "tool_use");
      return toolUse && toolUse.type === "tool_use" ? toolUse.input : null;
    },
  };
}
