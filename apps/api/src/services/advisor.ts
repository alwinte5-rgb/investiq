import { prisma } from "@investiq/db";
import { FORBIDDEN_DIRECTIVE_PATTERNS } from "@investiq/shared";
import type { Advisor } from "@investiq/ai";

/**
 * AI Advisor service. Assembles a light, factual context from the user's own
 * forex data (risk settings + open trade plans + journal stats) and asks the
 * non-advisory tutor model. A forbidden-language guard replaces any answer that
 * slips into buy/sell directives — defense in depth behind the system prompt.
 */
export interface AdvisorService {
  ask(userId: string, question: string): Promise<{ answer: string }>;
  readonly enabled: boolean;
}

const NON_ADVISORY_FALLBACK =
  "I can't give personalized trade advice or predict where a currency pair is going — InvestIQ Forex is educational only. " +
  "What I can do is explain the mechanics (pips, lots, leverage, margin, stop losses, position sizing) and help you understand exactly what a trade would risk. Open the Trade Calculator to see the numbers for a specific setup. The decision is always yours.";

/**
 * Guard: never return advisory directive language. If the model output is empty
 * or trips a forbidden-directive pattern, swap in the safe educational fallback.
 * Pure + exported for tests. Defense in depth behind the system prompt.
 */
export function enforceNonAdvisory(raw: string): string {
  return raw && !FORBIDDEN_DIRECTIVE_PATTERNS.some((p) => p.test(raw)) ? raw : NON_ADVISORY_FALLBACK;
}

/** Compact, factual snapshot of the user's forex data for the model to reference. */
async function buildContext(userId: string): Promise<string> {
  const [settings, openPlans, closedCount] = await Promise.all([
    prisma.userForexSettings.findUnique({
      where: { userId },
      select: {
        accountCurrency: true,
        defaultAccountBalance: true,
        defaultRiskPercentage: true,
        maximumRiskPercentage: true,
        defaultLeverage: true,
        preferredRewardRatio: true,
      },
    }),
    prisma.tradePlan.findMany({
      where: { userId, status: { in: ["DRAFT", "PLANNED", "ENTERED"] } },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        direction: true,
        status: true,
        riskPercentage: true,
        riskAmount: true,
        rewardRatio: true,
        riskStatus: true,
        pair: { select: { symbol: true } },
      },
    }),
    prisma.journalEntry.count({ where: { userId, profitLossAmount: { not: null } } }),
  ]);

  const lines: string[] = [];
  if (settings) {
    lines.push(
      `Risk settings: account ${settings.accountCurrency} ${settings.defaultAccountBalance}, ` +
        `default risk ${settings.defaultRiskPercentage}%, max risk ${settings.maximumRiskPercentage}%, ` +
        `broker leverage ${settings.defaultLeverage}:1, preferred reward ratio 1:${settings.preferredRewardRatio}.`,
    );
  }
  if (openPlans.length > 0) {
    lines.push("Open trade plans (the user's own planning data, not advice):");
    for (const p of openPlans) {
      lines.push(
        `- ${p.pair.symbol} ${p.direction} [${p.status}]: risk ${p.riskPercentage}%` +
          (p.riskAmount ? ` (${p.riskAmount})` : "") +
          (p.rewardRatio ? `, reward ratio 1:${p.rewardRatio}` : "") +
          (p.riskStatus ? `, plan check: ${p.riskStatus}` : ""),
      );
    }
  }
  if (closedCount > 0) lines.push(`Journal: ${closedCount} closed trades recorded.`);
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
