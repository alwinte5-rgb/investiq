"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  generateReviewAction,
  type ReviewContent,
  type ReviewPeriod,
  type StoredReview,
} from "@/app/(authed)/reviews/actions";

const PERIODS: { key: ReviewPeriod; label: string }[] = [
  { key: "MORNING", label: "Morning briefing" },
  { key: "WEEKLY", label: "Weekly review" },
  { key: "MONTHLY", label: "Monthly review" },
];

function FlagRow({ flag }: { flag: ReviewContent["flags"][number] }) {
  const tone =
    flag.severity === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-blue-200 bg-blue-50 text-blue-800";
  return (
    <li className={`rounded-md border p-3 text-sm ${tone}`}>
      <div className="font-medium">{flag.title}</div>
      <div className="text-xs opacity-90">{flag.detail}</div>
    </li>
  );
}

function ReviewBody({ content, generatedAt }: { content: ReviewContent; generatedAt?: string }) {
  return (
    <div className="space-y-4 rounded-lg border p-5">
      <div>
        <h3 className="text-lg font-semibold">{content.headline}</h3>
        <p className="mt-1 text-sm text-neutral-700">{content.summary}</p>
        {generatedAt && (
          <p className="mt-1 text-xs text-neutral-400">{new Date(generatedAt).toLocaleString()}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Health", content.healthScore],
          ["Diversification", content.diversificationScore],
          ["Risk", content.riskScore],
          ["Cash", content.cashScore],
        ].map(([label, val]) => (
          <div key={label as string} className="rounded-md border p-2 text-center">
            <div className="text-[11px] text-neutral-500">{label}</div>
            <div className="text-lg font-semibold">{val as number}</div>
          </div>
        ))}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold">
          {content.flags.length === 0 ? "Nothing to review" : `${content.flags.length} item(s) to review`}
        </h4>
        {content.flags.length > 0 && (
          <ul className="space-y-2">
            {content.flags.map((f, i) => (
              <FlagRow key={i} flag={f} />
            ))}
          </ul>
        )}
      </div>

      <p className="border-t pt-3 text-[11px] text-neutral-400">
        Educational only — not investment advice.
      </p>
    </div>
  );
}

export function ReviewsUI({
  initial,
  gated,
}: {
  initial: StoredReview | null;
  gated: boolean;
}) {
  const [period, setPeriod] = useState<ReviewPeriod>(initial?.period ?? "MORNING");
  const [content, setContent] = useState<ReviewContent | null>(initial?.content ?? null);
  const [generatedAt, setGeneratedAt] = useState<string | undefined>(initial?.generatedAt);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGated, setIsGated] = useState(gated);
  const [pending, start] = useTransition();

  function generate() {
    setError(null);
    setMessage(null);
    start(async () => {
      const res = await generateReviewAction(period);
      if (res.ok) {
        if (res.result.status === "insufficient") {
          setMessage(res.result.message);
          setContent(null);
        } else {
          const c = res.result.content ?? res.result.review.content;
          setContent(c);
          setGeneratedAt(res.result.review.generatedAt);
        }
      } else if (res.gated) {
        setIsGated(true);
      } else {
        setError(res.error);
      }
    });
  }

  if (isGated) {
    return (
      <div className="rounded-md border border-blue-200 bg-blue-50 p-5 text-sm text-blue-800">
        <p className="mb-2 font-medium">Reviews & briefings are an Investor feature.</p>
        <p className="mb-3">
          Upgrade to get morning briefings plus weekly and monthly reviews of your portfolio, with
          flags for concentration, position size, earnings and cash.
        </p>
        <Link
          href="/pricing"
          className="inline-block rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
        >
          See plans
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border p-0.5 text-xs">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded px-3 py-1.5 font-medium ${
                period === p.key ? "bg-blue-600 text-white" : "text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={generate}
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate now"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {message} Connect a brokerage and sync at least 3 holdings to generate a review.
        </div>
      )}

      {content ? (
        <ReviewBody content={content} generatedAt={generatedAt} />
      ) : (
        !message && (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-neutral-500">
            No review yet — pick a period and generate one.
          </div>
        )
      )}
    </div>
  );
}
