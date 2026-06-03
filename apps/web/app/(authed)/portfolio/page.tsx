import { apiFetch } from "@/lib/api";
import {
  PortfolioIntelligenceUI,
  type PortfolioView,
} from "@/components/portfolio-intelligence-ui";

export const dynamic = "force-dynamic"; // personalized — never statically cached

// The stored latest analysis row (totals aren't persisted — they appear after a
// fresh "Refresh analysis" / on the dashboard summary).
interface StoredAnalysis {
  id: string;
  healthScore: number;
  riskScore: number;
  diversificationScore: number;
  cashScore: number;
  sectorConcentration: PortfolioView["sectorConcentration"];
  overweight: PortfolioView["overweight"];
  underweight: PortfolioView["underweight"];
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  generatedAt: string;
}

export default async function PortfolioPage() {
  let initial: PortfolioView | null = null;
  let gated = false;

  try {
    const row = await apiFetch<StoredAnalysis | null>("/api/v1/portfolio/analysis");
    if (row) {
      initial = {
        healthScore: row.healthScore,
        riskScore: row.riskScore,
        diversificationScore: row.diversificationScore,
        cashScore: row.cashScore,
        sectorConcentration: row.sectorConcentration ?? [],
        overweight: row.overweight ?? [],
        underweight: row.underweight ?? [],
        strengths: row.strengths ?? [],
        weaknesses: row.weaknesses ?? [],
        improvements: row.improvements ?? [],
        generatedAt: row.generatedAt,
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/\b403\b|investor plan|forbidden/i.test(msg)) gated = true;
    // other errors fall through — the client shows an empty state with a Generate button
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Portfolio Intelligence</h1>
        <p className="text-sm text-neutral-500">
          Health, risk, diversification and cash scoring for your connected holdings.
        </p>
      </div>
      <PortfolioIntelligenceUI initial={initial} gated={gated} />
    </div>
  );
}
