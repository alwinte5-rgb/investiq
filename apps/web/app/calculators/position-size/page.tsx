import Link from "next/link";
import { PositionSizeCalculator } from "@/components/forex/position-size-calculator";

export const metadata = {
  title: "Free Forex Position-Size Calculator — InvestIQ Forex",
  description:
    "Calculate exactly how many units and lots to trade so your stop loss risks only what you planned. Free, no account required.",
};

/** PUBLIC position-size calculator — usable without an account (spec requirement). */
export default function PublicPositionSizePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Position-Size Calculator</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Work out the position size at which your stop loss risks exactly what you planned — in
          units and lots, with the pip value and estimated margin. Free to use, no account needed.
        </p>
      </div>

      <PositionSizeCalculator />

      <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
        Want the full trade calculator, saved plans, a journal, and session/event awareness?{" "}
        <Link href="/sign-up" className="font-medium text-blue-600 hover:underline">
          Create a free account
        </Link>{" "}
        or{" "}
        <Link href="/disclosures" className="underline">
          read our disclosures
        </Link>
        .
      </div>
    </div>
  );
}
