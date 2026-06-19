import { InMemoryTtlCache, fetchFredLatest, type MacroIndicator } from "@investiq/integrations";

/**
 * Macro service (FRED). Educational, non-personalized macro indicators for the
 * Learn hub. Cached for 12h (macro data changes slowly) and best-effort — a
 * provider blip yields an empty list, never an error.
 */
const MACRO_TTL_MS = 12 * 60 * 60 * 1000;

export interface MacroService {
  getMacro(): Promise<MacroIndicator[]>;
  readonly enabled: boolean;
}

export function createMacroService(opts: { fredKey?: string }): MacroService {
  const cache = new InMemoryTtlCache();
  const key = opts.fredKey;

  async function getMacro(): Promise<MacroIndicator[]> {
    if (!key) return [];
    const cached = cache.get<MacroIndicator[]>("macro");
    if (cached) return cached;
    const data = await fetchFredLatest(key);
    // Only cache a result that actually resolved at least one value.
    if (data.some((d) => d.value != null)) cache.set("macro", data, MACRO_TTL_MS);
    return data;
  }

  return { getMacro, enabled: !!key };
}
