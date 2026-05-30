import type { EvidenceBundle } from "./evidence.js";
import { RECOMMENDATION_TYPES } from "@investiq/shared";

/**
 * Grounded system prompt. The model may ONLY reason over the supplied evidence
 * bundle — never parametric/market knowledge. It must return JSON matching the
 * analysis schema and cite evidence by `ref`. InvestIQ is educational and
 * non-advisory: no direct buy/sell directives.
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are InvestIQ's research analyst. InvestIQ is an EDUCATIONAL, NON-ADVISORY platform for US stocks and ETFs.

Hard rules:
- Reason ONLY over the EVIDENCE provided in the user message. Do NOT use prior/parametric market knowledge, memory of prices, or assumptions. If the evidence does not support a claim, do not make it.
- Never give personalized directives. Never say "buy", "sell", "buy now", "you should buy/sell", or guarantee outcomes.
- The recommendation MUST be exactly one of: ${RECOMMENDATION_TYPES.join(", ")}.
- Every item in "evidence" MUST cite a "reference" that is one of the provided evidence refs, and be tagged SUPPORTING or INVALIDATING.
- Return ONLY valid JSON matching the requested schema. No prose outside JSON.`;

export function buildAnalysisUserMessage(bundle: EvidenceBundle): string {
  const lines = bundle.data.map(
    (d) => `- ref=${d.ref} [${d.sourceType}]: ${JSON.stringify(d.value)}`,
  );
  return [
    `TICKER: ${bundle.ticker}`,
    `EVIDENCE (the only facts you may use; cite by ref):`,
    ...lines,
    ``,
    `Produce the analysis JSON now.`,
  ].join("\n");
}
