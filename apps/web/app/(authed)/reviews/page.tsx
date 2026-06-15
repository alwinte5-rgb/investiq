import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { ReviewsUI } from "@/components/reviews-ui";
import type { GenerateReviewResult, StoredReview } from "./actions";

export const dynamic = "force-dynamic"; // personalized — never statically cached

export default async function ReviewsPage() {
  let initial: StoredReview | null = null;
  let gated = false;

  try {
    initial = await apiFetch<StoredReview | null>("/api/v1/portfolio/reviews");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/\b403\b|investor plan|forbidden/i.test(msg)) gated = true;
  }
  // Auto-generate today's briefing if none is stored yet (e.g. before the cron
  // runs) so the page shows a review instead of a "Generate" button. Generation
  // is deterministic (portfolio scoring, no AI/market calls).
  if (!gated && !initial) {
    try {
      const gen = await apiFetch<GenerateReviewResult>("/api/v1/portfolio/reviews?period=MORNING", {
        method: "POST",
      });
      if (gen.status === "created" || gen.status === "exists") initial = gen.review;
    } catch {
      /* leave null — the UI shows its empty/insufficient guidance */
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reviews & briefings</h1>
          <p className="text-sm text-neutral-500">
            Scheduled morning, weekly and monthly reviews of your portfolio.
          </p>
        </div>
        <Link href="/settings" className="text-xs text-blue-600 hover:underline">
          Notification settings →
        </Link>
      </div>
      <ReviewsUI initial={initial} gated={gated} />
    </div>
  );
}
