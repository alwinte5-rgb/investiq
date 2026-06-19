import { prisma } from "@investiq/db";
import { FORBIDDEN_DIRECTIVE_PATTERNS } from "@investiq/shared";
import type { Advisor } from "@investiq/ai";

/**
 * AI Advisor service (Layer 8+). Assembles a light, factual context from the
 * user's own data (portfolio scores + recently analyzed tickers) and asks the
 * non-advisory tutor model. A forbidden-language guard replaces any answer that
 * slips into buy/sell directives — defense in depth behind the system prompt.
 */
export interface AdvisorService {
  ask(userId: string, question: string): Promise<{ answer: string }>;
  readonly enabled: boolean;
}

const NON_ADVISORY_FALLBACK =
  "I can't give personalized buy/sell advice — InvestIQ is educational only. " +
  "What I can do is explain the factors to weigh (valuation, growth, risk, your time horizon, and how it fits your diversification), and you can run a full grounded analysis in Research to dig into the specifics. The decision is always yours.";

/**
 * Guard: never return advisory directive language. If the model output is empty
 * or trips a forbidden-directive pattern, swap in the safe educational fallback.
 * Pure + exported for tests. Defense in depth behind the system prompt.
 */
export function enforceNonAdvisory(raw: string): string {
  return raw && !FORBIDDEN_DIRECTIVE_PATTERNS.some((p) => p.test(raw)) ? raw : NON_ADVISORY_FALLBACK;
}

/** Compact, factual snapshot of the user's data for the model to reference. */
async function buildContext(userId: string): Promise<string> {
  const [portfolio, analyses] = await Promise.all([
    prisma.portfolioAnalysis.findFirst({
      where: { userId },
      orderBy: { generatedAt: "desc" },
      select: { healthScore: true, riskScore: true, diversificationScore: true, cashScore: true },
    }),
    prisma.analysis.findMany({
      where: { userId },
      distinct: ["symbolId"],
      orderBy: [{ symbolId: "asc" }, { generatedAt: "desc" }],
      take: 12,
      select: {
        recommendationType: true,
        confidenceScore: true,
        riskScore: true,
        symbol: { select: { ticker: true } },
      },
    }),
  ]);

  const lines: string[] = [];
  if (portfolio) {
    lines.push(
      `Portfolio scores (0–100): health ${portfolio.healthScore}, risk ${portfolio.riskScore}, ` +
        `diversification ${portfolio.diversificationScore}, cash buffer ${portfolio.cashScore}.`,
    );
  }
  if (analyses.length > 0) {
    lines.push("Stocks the user has analyzed (educational 'Watch' signals, not advice):");
    for (const a of analyses) {
      lines.push(
        `- ${a.symbol.ticker}: ${a.recommendationType} (confidence ${a.confidenceScore}/100, risk ${a.riskScore}/100)`,
      );
    }
  }
  return lines.join("\n");
}

export function createAdvisorService(deps: { advisor: Advisor }): AdvisorService {
  async function ask(userId: string, question: string): Promise<{ answer: string }> {
    const context = await buildContext(userId);
    const raw = await deps.advisor.answer(question, context);
    return { answer: enforceNonAdvisory(raw) };
  }

  return { ask, enabled: true };
}
