import Link from "next/link";

const RECOMMENDATION_TYPES = [
  "Strong Buy Watch",
  "Buy Watch",
  "Hold",
  "Trim Position",
  "Exit Consideration",
  "High Risk Warning",
  "Avoid",
  "Rebuy Watch",
];

export default function Landing() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          A research desk for everyday investors.
        </h1>
        <p className="max-w-2xl text-neutral-600">
          InvestIQ combines your portfolio, market data, news, and AI explanations into plain-English
          research for US stocks and ETFs. Every insight is grounded in connected data — never
          guesses. Educational only; we never tell you to buy or sell.
        </p>
        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open dashboard
          </Link>
          <Link href="/pricing" className="rounded-md border px-4 py-2 text-sm font-medium">
            See plans
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Research, not directives</h2>
        <div className="flex flex-wrap gap-2">
          {RECOMMENDATION_TYPES.map((r) => (
            <span key={r} className="rounded-full border px-3 py-1 text-xs text-neutral-700">
              {r}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
