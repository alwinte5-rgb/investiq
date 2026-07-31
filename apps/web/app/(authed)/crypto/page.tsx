import { PlatformPage } from "@/components/trading/platform-page";

export const dynamic = "force-dynamic";

export default function CryptoPage() {
  return <PlatformPage assetClass="crypto" title="Crypto" note="24/7 markets — Kraken/Yahoo data" />;
}
