const TIERS = [
  {
    name: "Free",
    points: ["1 connected account", "1 watchlist", "Limited AI analyses"],
  },
  {
    name: "Investor",
    points: ["Unlimited watchlists", "Portfolio intelligence", "Daily AI reviews", "News intelligence"],
  },
  {
    name: "Investor Plus",
    points: ["Multiple portfolios", "Advanced AI analysis", "Historical pattern engine", "Priority alerts"],
  },
];

export default function PricingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Plans</h1>
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
    </div>
  );
}
