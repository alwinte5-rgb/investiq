const TIERS = [
  {
    name: "Free",
    points: [
      "Pip, position-size, margin & risk-to-reward calculators",
      "Leverage visualizer",
      "Major currency-pair education",
      "Market sessions & lessons",
      "Up to 5 active trade plans",
      "Manual trading journal",
    ],
  },
  {
    name: "Trader",
    points: [
      "Unlimited trade plans",
      "Complete journal analytics",
      "Economic-event warnings in trade checks",
      "Cross & exotic pair education",
      "Saved custom risk rules",
    ],
  },
  {
    name: "Trader Plus",
    points: [
      "Multiple trading accounts",
      "Trade import",
      "Weekly performance review",
      "Advanced journal insights",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Plans</h1>
      <p className="max-w-2xl text-sm text-neutral-600">
        Every plan is educational tooling — risk math, planning, and journaling. No plan includes
        signals, predictions, or automated trading.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {TIERS.map((t) => (
          <div key={t.name} className="rounded-lg border p-5">
            <h2 className="font-semibold">{t.name}</h2>
            <ul className="mt-3 space-y-1 text-sm text-neutral-600">
              {t.points.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-neutral-400">
        Paid tiers are in preparation — all features are currently available while the platform is
        in review mode.
      </p>
    </div>
  );
}
