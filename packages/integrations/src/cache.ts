/**
 * Tiny TTL cache abstraction for NON-personalized market/news data (safe to
 * share across users). An in-memory implementation is provided for dev/tests;
 * production swaps in a Redis-backed implementation behind the same interface.
 * Personalized data must NEVER be cached here.
 */
export interface TtlCache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  /** Get-or-compute with TTL. */
  wrap<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T>;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

export class InMemoryTtlCache implements TtlCache {
  private store = new Map<string, Entry>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  async wrap<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await compute();
    this.set(key, value, ttlMs);
    return value;
  }
}
