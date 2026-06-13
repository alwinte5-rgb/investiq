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

export default async function LearnPage() {
  let sections: LearningSection[] = [];
  let error: string | null = null;
  try {
    sections = await apiFetch<LearningSection[]>("/api/v1/learning");
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load lessons";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Learn</h1>
        <p className="text-sm text-neutral-500">
          A plain-English path through investing basics — what the signals mean, how to manage risk,
          and how to build a portfolio. Educational only, never advice. Tap a topic to expand.
        </p>
      </div>

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
