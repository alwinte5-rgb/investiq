"use client";

import { useState } from "react";
import {
  TradeCalculator,
  type TradeCalculatorDefaults,
  type TradeCalculatorInitial,
} from "./trade-calculator";
import { PipCalculator } from "./pip-calculator";
import { PositionSizeCalculator } from "./position-size-calculator";
import { MarginCalculator } from "./margin-calculator";
import { RiskRewardCalculator } from "./risk-reward-calculator";
import { LeverageVisualizer } from "./leverage-visualizer";

const TABS = [
  { id: "trade", label: "Trade Calculator" },
  { id: "pip", label: "Pip Calculator" },
  { id: "position", label: "Position Size" },
  { id: "margin", label: "Margin" },
  { id: "rr", label: "Risk : Reward" },
  { id: "leverage", label: "Leverage" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** The calculator page family: the full trade calculator plus focused tools. */
export function CalculatorTabs({
  defaults,
  initial,
}: {
  defaults?: TradeCalculatorDefaults;
  initial?: TradeCalculatorInitial;
}) {
  const [tab, setTab] = useState<TabId>("trade");

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Calculators" className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "trade" && <TradeCalculator defaults={defaults} initial={initial} saveHref="/planner" />}
      {tab === "pip" && <PipCalculator />}
      {tab === "position" && <PositionSizeCalculator />}
      {tab === "margin" && <MarginCalculator />}
      {tab === "rr" && <RiskRewardCalculator />}
      {tab === "leverage" && <LeverageVisualizer />}
    </div>
  );
}
