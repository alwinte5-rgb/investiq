import { SessionsUI } from "@/components/forex/sessions-ui";

export const dynamic = "force-dynamic";

export default function SessionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Market Sessions</h1>
        <p className="text-sm text-slate-500">
          The forex day rolls through Sydney, Tokyo, London, and New York. Times below follow each
          city&apos;s own clock (daylight-saving aware) and convert into your local time.
        </p>
      </div>

      <SessionsUI />

      <section className="space-y-2 rounded-lg border bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
        <h2 className="text-sm font-semibold text-slate-800">Why sessions matter</h2>
        <p>
          Liquidity and volatility change through the day. A pair usually moves most while its home
          markets are open — EUR/USD during London and New York, USD/JPY during Tokyo and New York.
        </p>
        <p>
          Session <strong>overlaps</strong> (especially London + New York) are typically the most
          liquid hours, which often means tighter spreads. Quieter hours can bring wider spreads and
          thinner order books, so identical position sizes can behave very differently by time of
          day. This is context for planning — not a signal about direction.
        </p>
      </section>
    </div>
  );
}
