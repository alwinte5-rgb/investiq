import type { AnalysisOutput } from "@investiq/shared";
import { checkBundleSufficiency, type EvidenceBundle } from "./evidence.js";
import { computeInputsHash } from "./hash.js";
import { validateAnalysisOutput } from "./validator.js";
import type { AnalysisModel } from "./model.js";

/**
 * Ports the analysis pipeline needs from the outside world. The API layer
 * supplies prisma-backed implementations; tests supply fakes. Keeping these
 * injected makes the DoD logic (no model call on incomplete data, cache reuse,
 * quota enforced before generation, invalid output discarded) testable without
 * a database or network.
 */
export interface AnalysisPorts<TStored> {
  /** Existing analysis for this exact inputs hash, or null. */
  loadCached(inputsHash: string): Promise<TStored | null>;
  /** True if the user is still under their AI quota for the period. */
  quotaOk(): Promise<boolean>;
  /** Persist a validated analysis (+ evidence, + usage increment) and return it. */
  persist(args: {
    output: AnalysisOutput;
    bundle: EvidenceBundle;
    inputsHash: string;
    model: string;
  }): Promise<TStored>;
}

export type AnalysisResult<TStored> =
  | { status: "insufficient"; message: string; missing: string[] }
  | { status: "cached"; analysis: TStored }
  | { status: "created"; analysis: TStored }
  | { status: "quota_exceeded" }
  | { status: "invalid_output"; reason: string };

/**
 * Run the grounded analysis pipeline. Order is load-bearing:
 *   1. sufficiency  — incomplete bundle ⇒ exact message, NO model call, NO quota use
 *   2. cache        — identical inputs ⇒ stored analysis, NO model call, NO quota use
 *   3. quota        — over limit ⇒ stop BEFORE calling the model
 *   4. generate     — call the model (only now do we spend)
 *   5. validate     — schema + grounding + forbidden language; invalid ⇒ discard, NO persist
 *   6. persist      — store analysis + evidence and increment usage
 */
export async function runAnalysis<TStored>(
  bundle: EvidenceBundle,
  model: AnalysisModel,
  ports: AnalysisPorts<TStored>,
): Promise<AnalysisResult<TStored>> {
  const check = checkBundleSufficiency(bundle);
  if (!check.ok) {
    return { status: "insufficient", message: check.message!, missing: check.missing };
  }

  const inputsHash = computeInputsHash(bundle, model.name);

  const cached = await ports.loadCached(inputsHash);
  if (cached) return { status: "cached", analysis: cached };

  if (!(await ports.quotaOk())) return { status: "quota_exceeded" };

  const raw = await model.generate(bundle);
  const validation = validateAnalysisOutput(raw, bundle);
  if (!validation.ok) return { status: "invalid_output", reason: validation.reason };

  const analysis = await ports.persist({
    output: validation.output,
    bundle,
    inputsHash,
    model: model.name,
  });
  return { status: "created", analysis };
}
