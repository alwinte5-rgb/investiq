import Link from "next/link";
import { CURRENCY_PAIRS, type CurrencyPairInfo } from "@investiq/shared";

export const dynamic = "force-dynamic";

// Catalog content is static reference data from the shared package (also
// seeded into the DB for relations); no fetch needed to render it.
const GROUPS: { title: string; category: CurrencyPairInfo["category"]; blurb: string }[] = [
  {
    title: "Major pairs",
    category: "MAJOR",
    blurb: "The most-traded USD pairs — generally higher liquidity and tighter spreads.",
  },
  {
    title: "Minor / cross pairs",
    category: "MINOR",
    blurb: "No US dollar leg — often slightly wider spreads than majors.",
  },
  {
    title: "Exotic pairs",
    category: "EXOTIC",
    blurb:
      "One emerging-market currency — typically wider spreads, lower liquidity, and larger rollover costs.",
  },
];

export default function PairsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Currency Pairs</h1>
        <p className="text-sm text-slate-500">
          What each pair is, how it&apos;s quoted, and what to be aware of before trading it.
          Educational profiles — no pair is ever a recommendation.
        </p>
      </div>

      {GROUPS.map((g) => (
        <section key={g.category} className="space-y-2">
          <div>
            <h2 className="text-lg font-semibold">{g.title}</h2>
            <p className="text-sm text-slate-500">{g.blurb}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CURRENCY_PAIRS.filter((p) => p.category === g.category).map((p) => (
              <Link
                key={p.symbol}
                href={`/pairs/${p.symbol.replace("/", "-")}`}
                className="rounded-lg border p-4 hover:border-blue-300 hover:bg-blue-50/30"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold tabular-nums text-slate-900">{p.symbol}</span>
                  <span className="text-[11px] text-slate-400">pip {p.pipSize}</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">{p.displayName}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.educationLabels.slice(0, 2).map((l) => (
                    <span key={l} className="rounded-full border px-2 py-0.5 text-[10px] text-slate-500">
                      {l}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
