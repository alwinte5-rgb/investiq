"use client";

import { useEffect, useState } from "react";
import {
  getRecommendationLearningAction,
  getRiskLearningAction,
  type LearningContent,
} from "@/app/(authed)/research/actions";

/**
 * Layer 10 — inline educational content. Surfaced beneath a recommendation
 * (kind="recommendation") or a risk assessment (kind="risk"). Non-advisory:
 * it teaches the concepts behind the signal, never what to do. Loads lazily and
 * stays silent if there is nothing to show, so it never blocks the panel above.
 */
type Props =
  | { kind: "recommendation"; recType: string }
  | { kind: "risk" };

function LearnItem({ item }: { item: LearningContent }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 py-2 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-neutral-700">{item.title}</span>
        <span className="text-neutral-400">{open ? "–" : "+"}</span>
      </button>
      {open && <p className="pb-2 text-sm text-neutral-600">{item.body}</p>}
    </li>
  );
}

export function LearnPanel(props: Props) {
  const [items, setItems] = useState<LearningContent[]>([]);
  // Re-fetch when the recommendation type changes (analysing a new ticker).
  const key = props.kind === "recommendation" ? props.recType : "risk";

  useEffect(() => {
    let active = true;
    (async () => {
      const res =
        props.kind === "recommendation"
          ? await getRecommendationLearningAction(props.recType)
          : await getRiskLearningAction();
      if (active && res.ok) setItems(res.items);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (items.length === 0) return null;

  return (
    <div className="rounded-md border border-blue-100 bg-blue-50/40 p-3">
      <h4 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-blue-900">
        <span aria-hidden>📘</span> Learn the concepts
      </h4>
      <p className="mb-1 text-[11px] text-blue-900/60">
        Educational background to help you interpret this for yourself — not advice.
      </p>
      <ul className="divide-y divide-blue-100">
        {items.map((item) => (
          <LearnItem key={item.slug} item={item} />
        ))}
      </ul>
    </div>
  );
}
