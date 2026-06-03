import { ResearchUI } from "@/components/analysis-ui";

export const dynamic = "force-dynamic"; // personalized — never statically cached

export default function ResearchPage({
  searchParams,
}: {
  searchParams: { ticker?: string };
}) {
  const initialTicker = (searchParams.ticker ?? "").trim().toUpperCase();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Research</h1>
        <p className="text-sm text-neutral-500">
          Get an evidence-grounded AI analysis for any US stock or ETF.
        </p>
      </div>
      <ResearchUI initialTicker={initialTicker} />
    </div>
  );
}
