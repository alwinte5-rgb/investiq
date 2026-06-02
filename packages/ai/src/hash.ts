import { createHash } from "node:crypto";
import type { EvidenceBundle } from "./evidence.js";

/**
 * Deterministic hash of the inputs that produced an analysis: the model name +
 * the evidence bundle (refs, source types, values). Stored on the Analysis row
 * so a regeneration is only performed when the inputs actually changed — an
 * identical bundle returns the cached analysis instead of paying for the model.
 *
 * Data are sorted by `ref` so bundle ordering never changes the hash.
 */
export function computeInputsHash(bundle: EvidenceBundle, modelName: string): string {
  const canonical = {
    ticker: bundle.ticker.toUpperCase(),
    model: modelName,
    data: bundle.data
      .map((d) => ({ ref: d.ref, sourceType: d.sourceType, value: d.value }))
      .sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0)),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
