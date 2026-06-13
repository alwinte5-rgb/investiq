import { DEMO_HOLDINGS, type Plan } from "@investiq/shared";
import { generateAnalysis, type AnalysisDeps } from "./analysis.js";
import { assessSymbolRisk, type RiskDeps } from "./risk.js";
import { generateOpportunities } from "./opportunities.js";

export interface DemoWarmUpDeps {
  analysis: AnalysisDeps;
  risk: RiskDeps;
}

type WarmUpLog = (msg: string, err?: unknown) => void;

/**
 * After a user loads the sample-data portfolio, generate REAL grounded analyses
 * + risk assessments for each demo holding so the AI-derived screens (Research,
 * Risk, Opportunities) light up with genuine data instead of empty states.
 *
 * Nothing here is fabricated: each analysis runs the exact same grounded pipeline
 * as a manual request — real prices/news/fundamentals for these real tickers —
 * and degrades to "insufficient" rather than inventing data. It is idempotent and
 * cached by inputsHash, so re-loading the demo is cheap. Best-effort and
 * sequential: a failure on one ticker never blocks the others or the demo itself.
 * Intended to run fire-and-forget; the user sees results on the next refresh.
 */
export async function warmUpDemoAnalyses(
  userId: string,
  plan: Plan,
  deps: DemoWarmUpDeps,
  log?: WarmUpLog,
): Promise<void> {
  for (const h of DEMO_HOLDINGS) {
    try {
      await generateAnalysis(userId, plan, h.ticker, deps.analysis);
    } catch (e) {
      log?.(`[demo-warmup] analysis failed for ${h.ticker}`, e);
    }
    try {
      await assessSymbolRisk(userId, h.ticker, deps.risk);
    } catch (e) {
      log?.(`[demo-warmup] risk failed for ${h.ticker}`, e);
    }
  }
  // Build the opportunity set now that analyses + risk exist for the holdings.
  try {
    await generateOpportunities(userId, plan);
  } catch (e) {
    log?.("[demo-warmup] opportunities failed", e);
  }
}
