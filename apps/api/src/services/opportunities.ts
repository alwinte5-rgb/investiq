import { prisma, Prisma } from "@investiq/db";
import {
  buildOpportunities,
  OPPORTUNITY_LABELS,
  OPPORTUNITY_TYPES,
  type NewsTone,
  type Opportunity,
  type OpportunityGroup,
  type OpportunityInput,
  type OpportunitySupporting,
  type OpportunityType,
  type Plan,
  type RecommendationType,
  type WarningColor,
} from "@investiq/shared";
import { requireEntitlement } from "../lib/auth.js";

/**
 * Layer 8 — Opportunity Engine. Categorizes the user's STORED per-symbol analyses
 * (L2) into ranked, explainable opportunity lists, enriched with the context
 * earlier layers already produced: whether they hold the symbol (L1/L3), the
 * latest risk color (L6), and the latest grounded news tone (L5).
 *
 * Deterministic and read-only over stored data — no live market or model calls —
 * so the lists are reproducible and every item is explainable from data the user
 * already has. Investor+ gated server-side. Educational "Watch" framing.
 */

const FEATURE_LABEL = "Opportunities";

/** Pull the first SUPPORTING evidence note from a stored analysis, if any. */
function supportingNote(evidence: { role: string; snapshot: unknown }[]): string | null {
  for (const e of evidence) {
    if (e.role !== "SUPPORTING") continue;
    const snap = e.snapshot;
    if (snap && typeof snap === "object" && "note" in snap) {
      const note = (snap as { note?: unknown }).note;
      if (typeof note === "string" && note.trim()) return note.trim();
    }
  }
  return null;
}

/** Group a flat list into ordered, ranked sections (shared canonical order). */
function groupItems(items: Opportunity[]): OpportunityGroup[] {
  return OPPORTUNITY_TYPES.map((type) => ({
    type,
    label: OPPORTUNITY_LABELS[type],
    items: items
      .filter((o) => o.type === type)
      .sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker)),
  })).filter((g) => g.items.length > 0);
}

async function assembleInputs(userId: string): Promise<OpportunityInput[]> {
  // Latest analysis per symbol for this user (DISTINCT ON symbolId, newest first),
  // plus the held set + latest risk color, in parallel.
  const [analyses, holdings, risks] = await Promise.all([
    prisma.analysis.findMany({
      where: { userId },
      distinct: ["symbolId"],
      orderBy: [{ symbolId: "asc" }, { generatedAt: "desc" }],
      select: {
        symbolId: true,
        recommendationType: true,
        confidenceScore: true,
        riskScore: true,
        symbol: { select: { ticker: true, name: true, assetType: true } },
        evidence: { select: { role: true, snapshot: true } },
      },
    }),
    prisma.holding.findMany({
      where: { account: { connection: { userId } }, marketValue: { gt: 0 } },
      select: { symbolId: true },
    }),
    prisma.riskAssessment.findMany({
      where: { userId },
      distinct: ["symbolId"],
      orderBy: [{ symbolId: "asc" }, { generatedAt: "desc" }],
      select: { symbolId: true, warningColor: true },
    }),
  ]);

  const symbolIds = analyses.map((a) => a.symbolId);
  // Latest news tone per analyzed symbol (global per-symbol classification).
  const newsRows = symbolIds.length
    ? await prisma.newsImpact.findMany({
        where: { symbolId: { in: symbolIds } },
        orderBy: { generatedAt: "desc" },
        select: { symbolId: true, impact: true },
      })
    : [];

  const heldIds = new Set(holdings.map((h) => h.symbolId));
  const colorBySymbol = new Map(risks.map((r) => [r.symbolId, r.warningColor as WarningColor]));
  const toneBySymbol = new Map<string, NewsTone>();
  for (const n of newsRows) if (!toneBySymbol.has(n.symbolId)) toneBySymbol.set(n.symbolId, n.impact as NewsTone);

  return analyses.map<OpportunityInput>((a) => ({
    ticker: a.symbol.ticker,
    name: a.symbol.name,
    assetType: a.symbol.assetType as "STOCK" | "ETF",
    recommendationType: a.recommendationType as RecommendationType,
    confidenceScore: a.confidenceScore,
    riskScore: a.riskScore,
    held: heldIds.has(a.symbolId),
    warningColor: colorBySymbol.get(a.symbolId) ?? null,
    newsTone: toneBySymbol.get(a.symbolId) ?? null,
    evidenceNote: supportingNote(a.evidence),
  }));
}

/**
 * Regenerate the user's opportunity set from stored analyses + context, replacing
 * the previous set atomically. Returns the grouped, ranked lists. Investor+ gated.
 */
export async function generateOpportunities(userId: string, plan: Plan): Promise<OpportunityGroup[]> {
  requireEntitlement(plan, "opportunities", FEATURE_LABEL);

  const inputs = await assembleInputs(userId);
  const groups = buildOpportunities(inputs);
  const flat = groups.flatMap((g) => g.items);

  // Resolve symbolIds for persistence (the symbols we just categorized).
  const symbolIdByTicker = new Map<string, string>();
  if (flat.length > 0) {
    const symbols = await prisma.symbol.findMany({
      where: { ticker: { in: flat.map((o) => o.ticker) } },
      select: { id: true, ticker: true },
    });
    for (const s of symbols) symbolIdByTicker.set(s.ticker, s.id);
  }

  await prisma.$transaction([
    prisma.opportunity.deleteMany({ where: { userId } }),
    prisma.opportunity.createMany({
      data: flat
        .filter((o) => symbolIdByTicker.has(o.ticker))
        .map((o) => ({
          userId,
          symbolId: symbolIdByTicker.get(o.ticker)!,
          type: o.type as OpportunityType,
          score: o.score,
          confidence: o.confidence,
          risk: o.risk,
          explanation: o.explanation,
          supportingData: o.supporting as unknown as Prisma.InputJsonValue,
        })),
    }),
  ]);

  return groups;
}

/** Read the stored opportunity set, grouped + ranked. Investor+ gated. */
export async function getOpportunities(userId: string, plan: Plan): Promise<OpportunityGroup[]> {
  requireEntitlement(plan, "opportunities", FEATURE_LABEL);

  const rows = await prisma.opportunity.findMany({
    where: { userId },
    orderBy: { score: "desc" },
    select: {
      type: true,
      score: true,
      confidence: true,
      risk: true,
      explanation: true,
      supportingData: true,
      symbol: { select: { ticker: true, name: true } },
    },
  });

  const items: Opportunity[] = rows.map((r) => ({
    ticker: r.symbol.ticker,
    name: r.symbol.name,
    type: r.type as OpportunityType,
    score: r.score,
    confidence: r.confidence,
    risk: r.risk,
    explanation: r.explanation,
    supporting: r.supportingData as unknown as OpportunitySupporting,
  }));

  return groupItems(items);
}
