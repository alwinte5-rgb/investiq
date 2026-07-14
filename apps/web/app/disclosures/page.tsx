export const metadata = { title: "Disclosures — InvestIQ Forex" };

export default function DisclosuresPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Disclosures</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Educational tools, not advice</h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Invest IQ Forex provides educational tools and estimated calculations. It does not
          provide personalized financial advice, trade signals, or brokerage services. Nothing in
          this application is a recommendation to buy or sell any currency pair or other
          instrument. All trading decisions are yours alone.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Risk of forex trading</h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Forex trading involves substantial risk. Leverage can magnify both gains and losses, and
          it is possible to lose more than your initial deposit with some brokers. Never trade
          with money you cannot afford to lose. Past performance — yours or anyone else&apos;s —
          does not guarantee future results.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Estimated calculations</h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Calculations may differ from broker results because of spreads, commissions, swap
          charges, slippage, contract specifications, margin policies, and exchange-rate changes.
          Margin figures shown in this application are estimates; your broker&apos;s margin and
          margin-call rules take precedence. Where live exchange rates are unavailable,
          calculations use rates you enter manually and are labeled accordingly.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Economic-event information</h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Economic-calendar entries are shown for volatility awareness only. They are never a
          basis for a directional trade recommendation, and event times, forecasts, and actual
          values may be revised by their sources.
        </p>
      </section>
    </div>
  );
}
