import { AdvisorUI } from "@/components/advisor-ui";

export const dynamic = "force-dynamic"; // personalized — never statically cached

export default function AdvisorPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Advisor</h1>
        <p className="text-sm text-slate-500">
          Ask anything about investing or your portfolio — answered in plain English and grounded in
          your own data. Educational only, never buy/sell advice.
        </p>
      </div>
      <AdvisorUI />
    </div>
  );
}
