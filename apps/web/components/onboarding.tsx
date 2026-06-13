"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { loadDemoPortfolioAction } from "@/app/(authed)/dashboard/actions";

/**
 * First-run getting-started guide. Shown only to brand-new users (no brokerage
 * connection at all) so it greets a beginner instead of dropping them on a bare
 * "Connect a brokerage" prompt. Data-driven: the moment the user loads sample
 * data or connects a broker, `isNewUser` flips false and this unmounts — it is
 * never a nag. Dismissible (per-browser) with a slim re-open link. Non-advisory.
 */
const DISMISS_KEY = "iq_onboarding_dismissed_v1";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
        {n}
      </span>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-neutral-800">{title}</p>
        {children}
      </div>
    </li>
  );
}

export function OnboardingGuide({ isNewUser }: { isNewUser: boolean }) {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // localStorage is client-only; read after mount to avoid a hydration mismatch.
  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    setReady(true);
  }, []);

  if (!isNewUser || !ready) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }
  function reopen() {
    localStorage.removeItem(DISMISS_KEY);
    setDismissed(false);
  }
  function exploreSample() {
    setError(null);
    start(async () => {
      const res = await loadDemoPortfolioAction();
      if (!res.ok) setError(res.error ?? "Failed to load sample data");
      // On success the action revalidates /dashboard → this card unmounts.
    });
  }

  if (dismissed) {
    return (
      <button type="button" onClick={reopen} className="text-xs text-blue-600 hover:underline">
        New here? Show the getting-started guide
      </button>
    );
  }

  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50/60 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">👋 Welcome to InvestIQ</h2>
          <p className="mt-0.5 text-sm text-neutral-600">
            Research stocks and ETFs, understand the risks, and learn as you go — in plain English.
            We never tell you to buy or sell; we help you decide for yourself.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="flex-none text-xs text-neutral-400 hover:text-neutral-600"
          aria-label="Hide the getting-started guide"
        >
          Hide
        </button>
      </div>

      <ol className="space-y-4">
        <Step n={1} title="Explore with sample data — no brokerage needed">
          <p className="text-sm text-neutral-600">
            See the whole app populated instantly with an example portfolio, then look around.
          </p>
          <button
            type="button"
            onClick={exploreSample}
            disabled={pending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Loading sample data…" : "Explore with sample data"}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </Step>

        <Step n={2} title="Research any stock">
          <p className="text-sm text-neutral-600">
            Type a ticker for an evidence-based breakdown: the bull case, bear case, key risks, and a
            plain-English signal — grounded in real data, never guesses.
          </p>
          <Link
            href="/research"
            className="inline-block rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            Research a stock →
          </Link>
        </Step>

        <Step n={3} title="Learn as you go">
          <p className="text-sm text-neutral-600">
            See a term you don&apos;t know? Any{" "}
            <span className="border-b border-dotted border-neutral-400">underlined word</span> is
            tappable for a plain-English definition — no finance background required.
          </p>
        </Step>
      </ol>
    </section>
  );
}
