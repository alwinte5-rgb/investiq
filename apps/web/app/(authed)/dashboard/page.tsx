import { loadQuantStatus } from "@/components/trading/load-status";
import {
  AlarmBanner,
  AlpacaSummaryPanel,
  OpenPositionsTable,
  SignalsPanel,
  TradesFeed,
} from "@/components/trading/panels";
import { EmptyState, Panel, SectionLink, StatTile } from "@/components/trading/ui";
import { TickerTape } from "@/components/tv/widgets";
import { SessionsUI } from "@/components/forex/sessions-ui";

export const dynamic = "force-dynamic"; // personalized — never statically cached

/** Overview — the whole trading program at a glance: every platform's equity,
 * all open positions, upcoming trades, alarms, and the live market tape. The
 * forex-specific dashboard content lives on /forex now. */
export default async function OverviewPage() {
  const status = await loadQuantStatus();

  const incubator = status?.incubator ?? [];
  const paperEquity = incubator.reduce((sum, b) => sum + (b.equity ?? 0), 0);
  const paperPnlPct = incubator.length
    ? incubator.reduce((s, b) => s + (b.pnl_pct ?? 0), 0) / incubator.length
    : null;
  const openCount = incubator.reduce(
    (n, b) => n + (b.positions?.length ?? (b.position ? 1 : 0)),
    0,
  );
  const alpacaEquity = parseFloat(status?.alpaca?.account?.equity ?? "");
  const firing = (status?.signals ?? []).filter((s) => s.action).length;

  const tapeSymbols = (status?.prices ?? []).map((p) => p.symbol);
  if (!tapeSymbols.length)
    tapeSymbols.push("SPY", "QQQ", "BTC-USD", "ETH/USD", "NG=F", "AUDCAD=X");

  return (
    <div className="space-y-5">
      <TickerTape symbols={tapeSymbols} />

      <AlarmBanner dataHealth={status?.data_health} incubator={incubator} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Paper bots equity"
          value={
            paperEquity
              ? `$${paperEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : "—"
          }
          sub={`${incubator.length} bots incubating`}
        />
        <StatTile
          label="Avg bot P&L"
          value={
            paperPnlPct != null
              ? `${paperPnlPct >= 0 ? "+" : ""}${paperPnlPct.toFixed(2)}%`
              : "—"
          }
          tone={paperPnlPct == null ? undefined : paperPnlPct >= 0 ? "pos" : "neg"}
        />
        <StatTile
          label="Alpaca paper"
          value={Number.isNaN(alpacaEquity) ? "—" : `$${alpacaEquity.toLocaleString()}`}
          sub="options level 3"
        />
        <StatTile
          label="Signals firing"
          value={firing}
          sub={`${openCount} open position${openCount === 1 ? "" : "s"}`}
          tone={firing > 0 ? "pos" : undefined}
        />
      </div>

      {!status ? (
        <Panel>
          <EmptyState>
            No quant-lab snapshot yet — the Mac-side cron pushes every 5 minutes.
          </EmptyState>
        </Panel>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Open positions" action={<SectionLink href="/bots">All bots →</SectionLink>}>
          <OpenPositionsTable incubator={incubator} />
        </Panel>
        <Panel title="Upcoming trades (live signals)">
          <SignalsPanel signals={status?.signals} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Recent trades"
          action={<SectionLink href="/research">Lab results →</SectionLink>}
        >
          <TradesFeed incubator={incubator} />
        </Panel>
        <div className="space-y-5">
          <AlpacaSummaryPanel alpaca={status?.alpaca} />
          <Panel title="Market sessions" action={<SectionLink href="/sessions">Details →</SectionLink>}>
            <SessionsUI compact />
          </Panel>
        </div>
      </div>
    </div>
  );
}
