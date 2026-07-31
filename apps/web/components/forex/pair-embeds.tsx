"use client";

import { useState } from "react";
import { PipCalculator } from "./pip-calculator";
import { PositionSizeCalculator } from "./position-size-calculator";

/**
 * Embedded calculators on a pair profile page. Kept behind expanders so the
 * profile stays readable; both tools default to their own state (the pair
 * selector inside each is preset-friendly enough for an educational embed).
 */
export function PairEmbeds({ symbol }: { symbol: string }) {
  const [open, setOpen] = useState<"pip" | "size" | null>(null);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-t1">Try it with {symbol}</h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen(open === "pip" ? null : "pip")}
          className={`rounded-md border px-4 py-2 text-sm font-medium ${
            open === "pip" ? "border-accent bg-accent-soft text-accent" : "hover:bg-raised"
          }`}
        >
          Pip calculator
        </button>
        <button
          type="button"
          onClick={() => setOpen(open === "size" ? null : "size")}
          className={`rounded-md border px-4 py-2 text-sm font-medium ${
            open === "size" ? "border-accent bg-accent-soft text-accent" : "hover:bg-raised"
          }`}
        >
          Position-size example
        </button>
      </div>
      {open === "pip" && (
        <div className="rounded-lg border p-4">
          <PipCalculator />
        </div>
      )}
      {open === "size" && (
        <div className="rounded-lg border p-4">
          <PositionSizeCalculator />
        </div>
      )}
    </section>
  );
}
