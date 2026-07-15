import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

const TOOLS = [
  { name: "Trade Calculator", blurb: "Risk, position size, margin, and profit target in one view." },
  { name: "Pip Calculator", blurb: "What one pip is worth for your pair and position size." },
  { name: "Position-Size Calculator", blurb: "The size at which your stop loss costs exactly what you planned." },
  { name: "Margin Calculator", blurb: "Estimated margin — and why it isn't your maximum loss." },
  { name: "Leverage Visualizer", blurb: "Your money versus the money you're controlling." },
  { name: "Risk-to-Reward Calculator", blurb: "Break-even win rates for any target and stop." },
];

export default async function Landing() {
  // Signed-in users open straight into the app, not the marketing page.
  // (auth() throws in guest mode, where clerkMiddleware doesn't run.)
  const userId = await auth()
    .then((a) => a.userId)
    .catch(() => null);
  if (userId) redirect("/dashboard");
  const guestMode = process.env.GUEST_MODE === "true";

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Know Your Risk Before You Place the Trade
        </h1>
        <p className="max-w-2xl text-neutral-600">
          Invest IQ Forex turns pips, lots, margin, and leverage into clear dollar amounts.
          Calculate your position size, plan your trade, and understand exactly how much you could
          gain or lose before entering the market.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={guestMode ? "/calculator" : "/calculators/position-size"}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Calculate My Trade
          </Link>
          <Link
            href={guestMode ? "/learn" : "/sign-up"}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Learn How Forex Works
          </Link>
          {guestMode && (
            <Link
              href="/dashboard"
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              Open the app — no login needed
            </Link>
          )}
          <Link
            href="/pricing"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            See plans
          </Link>
        </div>
        <p className="text-xs text-slate-400">
          The position-size calculator is free to use — no account required.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tools for disciplined trade planning</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <div key={t.name} className="rounded-lg border p-4">
              <div className="text-sm font-medium text-slate-800">{t.name}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{t.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2 rounded-lg border bg-slate-50 p-5">
        <h2 className="text-lg font-semibold">Education and risk awareness — nothing else</h2>
        <p className="max-w-2xl text-sm text-slate-600">
          No signals, no predictions, no automated trading. InvestIQ Forex teaches how pips,
          lots, leverage, and margin actually work, and shows you the exact exposure of a planned
          trade — so the decision you make is an informed one, and it stays yours.
        </p>
      </section>
    </div>
  );
}
