import { PlatformPage } from "@/components/trading/platform-page";

export const dynamic = "force-dynamic";

export default function FuturesPage() {
  return (
    <PlatformPage
      assetClass="futures"
      title="Futures"
      note="signals derive from spot-proxy data (Yahoo continuous contracts) — honest limitation until a real futures feed"
    />
  );
}
