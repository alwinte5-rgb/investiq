import { INSUFFICIENT_DATA_MESSAGE } from "@investiq/shared";

/**
 * An evidence bundle is the ONLY thing the AI is allowed to reason over.
 * The backend assembles it from connected data sources. Each datum has a
 * stable `ref` that AI output must cite; output citing anything not present
 * here is rejected by the validator.
 */
export interface EvidenceDatum {
  ref: string; // stable id, e.g. "price:AAPL:close", "news:cuid123"
  sourceType: "PRICE" | "NEWS" | "EARNINGS" | "ANALYST" | "FUNDAMENTAL" | "PORTFOLIO" | "SECTOR";
  value: unknown;
}

export interface EvidenceBundle {
  ticker: string;
  data: EvidenceDatum[];
}

/** Required source categories before any recommendation may be generated. */
export const REQUIRED_SOURCE_TYPES: EvidenceDatum["sourceType"][] = [
  "PRICE",
  "NEWS",
  "FUNDAMENTAL",
];

export interface BundleCheck {
  ok: boolean;
  /** When not ok, the exact user-facing message to return. */
  message?: string;
  missing: EvidenceDatum["sourceType"][];
}

/**
 * Decide whether the bundle is complete enough to call the model. If not, the
 * caller returns INSUFFICIENT_DATA_MESSAGE and NEVER calls Claude.
 */
export function checkBundleSufficiency(bundle: EvidenceBundle): BundleCheck {
  const present = new Set(bundle.data.map((d) => d.sourceType));
  const missing = REQUIRED_SOURCE_TYPES.filter((t) => !present.has(t));
  if (missing.length > 0 || bundle.data.length === 0) {
    return { ok: false, message: INSUFFICIENT_DATA_MESSAGE, missing };
  }
  return { ok: true, missing: [] };
}

/** Set of valid references the AI output is allowed to cite. */
export function bundleRefs(bundle: EvidenceBundle): Set<string> {
  return new Set(bundle.data.map((d) => d.ref));
}
