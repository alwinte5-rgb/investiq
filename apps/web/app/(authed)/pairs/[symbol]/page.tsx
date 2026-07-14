import Link from "next/link";
import { notFound } from "next/navigation";
import { directionExplanations, explainRate, findPair } from "@investiq/shared";
import { PairEmbeds } from "@/components/forex/pair-embeds";
import { PairChart } from "@/components/forex/pair-chart";

export const dynamic = "force-dynamic";

/** Currency-pair profile: educational reference + embedded calculators. */
export default function PairDetailPage({ params }: { params: { symbol: string } }) {
  const info = findPair(params.symbol.replace(/-/g, "/"));
  if (!info) notFound();

  const explanations = directionExplanations(info);
  const categoryLabel =
    info.category === "MAJOR" ? "Major pair" : info.category === "MINOR" ? "Minor / cross pair" : "Exotic pair";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold tabular-nums text-slate-900">{info.symbol}</h1>
          <span className="rounded-full border px-2.5 py-0.5 text-xs text-slate-500">{categoryLabel}</span>
        </div>
        <p className="text-sm text-slate-500">{info.displayName}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="text-xs text-slate-500">Base currency</div>
          <div className="text-lg font-semibold">{info.baseCurrency}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-slate-500">Quote currency</div>
          <div className="text-lg font-semibold">{info.quoteCurrency}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-slate-500">Pip size</div>
          <div className="text-lg font-semibold tabular-nums">{info.pipSize}</div>
          <div className="text-[11px] text-slate-400">Pipette {info.pipetteSize}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-slate-500">Typical format</div>
          <div className="text-lg font-semibold tabular-nums">
            {info.pipSize === 0.01 ? "3 decimals" : "5 decimals"}
          </div>
        </div>
      </section>

      <section className="space-y-2 rounded-lg border bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
        <p>{info.description}</p>
        <p className="text-slate-500">
          Example: {explainRate(info, info.pipSize === 0.01 ? 145.25 : 1.085)}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold text-slate-800">What buying means</h2>
          <p className="mt-1 text-sm text-slate-600">{explanations.buy}</p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold text-slate-800">What selling means</h2>
          <p className="mt-1 text-sm text-slate-600">{explanations.sell}</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold text-slate-800">Most active sessions</h2>
          <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
            {info.sessions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <Link href="/sessions" className="mt-2 inline-block text-xs text-blue-600 hover:underline">
            View session times →
          </Link>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold text-slate-800">Central banks</h2>
          <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
            {info.centralBanks.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-slate-400">Economies: {info.economies.join(", ")}</p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold text-slate-800">Events traders watch</h2>
          <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
            {info.commonEvents.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <Link href="/calendar" className="mt-2 inline-block text-xs text-blue-600 hover:underline">
            Economic calendar →
          </Link>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Risk considerations</h2>
        <div className="flex flex-wrap gap-2">
          {info.educationLabels.map((l) => (
            <span key={l} className="rounded-full border px-3 py-1 text-xs text-slate-600">
              {l}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Live chart</h2>
        <PairChart pairSymbol={info.symbol} height={360} />
      </section>

      <PairEmbeds symbol={info.symbol} />
    </div>
  );
}
