import Link from "next/link";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic"; // served behind auth → no-store

interface LearningContent {
  slug: string;
  title: string;
  body: string;
  tags: string[];
}
interface LearningSection {
  title: string;
  intro: string;
  items: LearningContent[];
}
interface MacroIndicator {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  asOf: string | null;
  blurb: string;
}

export default async function LearnPage() {
  let sections: LearningSection[] = [];
  let error: string | null = null;
  try {
    sections = await apiFetch<LearningSection[]>("/api/v1/learning");
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load lessons";
  }
  // Live macro context (FRED) — best-effort, never blocks the lessons.
  const macro = (await apiFetch<MacroIndicator[]>("/api/v1/macro").catch(() => [])).filter(
    (m) => m.value != null,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Learn</h1>
        <p className="text-sm text-neutral-500">
          A plain-English path through investing basics — what the signals mean, how to manage risk,
          and how to build a portfolio. Educational only, never advice. Tap a topic to expand.
        </p>
      </div>

      {macro.length > 0 && (
        <section className="space-y-2">
          <div>
            <h2 className="text-lg font-semibold">Macro context</h2>
            <p className="text-sm text-neutral-500">
              The big-picture forces behind the market, with live figures. Educational background —
              not a market call.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {macro.map((m) => (
              <div key={m.id} className="rounded-lg border p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-neutral-700">{m.label}</span>
                  <span className="text-lg font-semibold tabular-nums text-neutral-900">
                    {m.value!.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    {m.unit}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">{m.blurb}</p>
                {m.asOf && <p className="mt-1 text-[11px] text-neutral-400">As of {m.asOf}</p>}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-neutral-400">Source: Federal Reserve (FRED).</p>
        </section>
      )}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load lessons: {error}
        </p>
      ) : sections.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-neutral-500">
          No lessons available right now.
        </p>
      ) : (
        sections.map((s) => (
          <section key={s.title} className="space-y-2">
            <div>
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <p className="text-sm text-neutral-500">{s.intro}</p>
            </div>
            <div className="divide-y rounded-lg border">
              {s.items.map((it) => (
                <details key={it.slug} className="p-3">
                  <summary className="cursor-pointer text-sm font-medium text-neutral-800">
                    {it.title}
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">{it.body}</p>
                </details>
              ))}
            </div>
          </section>
        ))
      )}

      <p className="border-t pt-3 text-xs text-neutral-400">
        See a term you don’t know elsewhere in InvestIQ? Any{" "}
        <span className="border-b border-dotted border-neutral-400">underlined word</span> is tappable
        for a definition. Ready to apply it?{" "}
        <Link href="/research" className="text-blue-600 hover:underline">
          Research a stock →
        </Link>
      </p>
    </div>
  );
}
