import {
  FmpProvider,
  InMemoryTtlCache,
  type FundamentalsProvider,
  type NormalizedFundamentals,
} from "@investiq/integrations";

const FUNDAMENTALS_TTL_MS = 6 * 60 * 60 * 1000; // 6h — fundamentals move slowly

export interface FundamentalsService {
  /** Returns null when no provider is configured or the symbol has no data. */
  getFundamentals(ticker: string): Promise<NormalizedFundamentals | null>;
  readonly enabled: boolean;
}

export interface FundamentalsServiceOptions {
  fmpKey?: string;
}

/**
 * Fundamentals service. Backed by FMP when a key is present. Non-personalized,
 * so results are cached in a shared TTL cache. A provider failure resolves to
 * null (not a throw) — the AI evidence bundle then simply lacks a FUNDAMENTAL
 * datum and the sufficiency check handles it.
 */
export function createFundamentalsService(opts: FundamentalsServiceOptions): FundamentalsService {
  const provider: FundamentalsProvider | null = opts.fmpKey ? new FmpProvider(opts.fmpKey) : null;
  const cache = new InMemoryTtlCache();

  async function getFundamentals(ticker: string): Promise<NormalizedFundamentals | null> {
    if (!provider) return null;
    return cache.wrap(`fund:${ticker.toUpperCase()}`, FUNDAMENTALS_TTL_MS, async () => {
      try {
        return await provider.getFundamentals(ticker);
      } catch {
        return null;
      }
    });
  }

  return { getFundamentals, enabled: provider !== null };
}
