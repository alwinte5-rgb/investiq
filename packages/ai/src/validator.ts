import {
  analysisOutputSchema,
  FORBIDDEN_DIRECTIVE_PATTERNS,
  type AnalysisOutput,
} from "@investiq/shared";
import { bundleRefs, type EvidenceBundle } from "./evidence.js";

export type ValidationResult =
  | { ok: true; output: AnalysisOutput }
  | { ok: false; reason: string };

/**
 * Validate raw model output BEFORE it is ever stored or shown. Rejects output
 * that: (1) fails the schema / uses an invalid recommendation type,
 * (2) contains a forbidden directive phrase (advisory language), or
 * (3) cites evidence not present in the supplied bundle (ungrounded).
 * Invalid output is discarded, never repaired-into-existence.
 */
export function validateAnalysisOutput(
  raw: unknown,
  bundle: EvidenceBundle,
): ValidationResult {
  const parsed = analysisOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: `schema: ${parsed.error.issues[0]?.message ?? "invalid"}` };
  }
  const output = parsed.data;

  // (2) forbidden directive language anywhere in the prose fields
  const prose = [
    output.summary,
    output.bullCase,
    output.bearCase,
    output.keyRisks,
    output.newsImpactSummary,
    output.technicalSummary,
    ...output.evidence.map((e) => e.note),
  ].join("\n");

  for (const pattern of FORBIDDEN_DIRECTIVE_PATTERNS) {
    if (pattern.test(prose)) {
      return { ok: false, reason: `forbidden directive language: ${pattern}` };
    }
  }

  // (3) grounding: every cited reference must exist in the bundle
  const allowed = bundleRefs(bundle);
  for (const item of output.evidence) {
    if (!allowed.has(item.reference)) {
      return { ok: false, reason: `ungrounded evidence reference: ${item.reference}` };
    }
  }

  return { ok: true, output };
}
