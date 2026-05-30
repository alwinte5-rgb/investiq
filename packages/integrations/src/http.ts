/**
 * Minimal fetch helper for vendor calls: enforces a timeout and maps failures
 * to a typed UpstreamError so callers (and the failover wrapper) can react
 * without leaking vendor internals.
 */
export class UpstreamError extends Error {
  constructor(
    public readonly vendor: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export async function fetchJson<T>(
  vendor: string,
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
  try {
    const res = await fetch(url, { headers: opts.headers, signal: ctrl.signal });
    if (!res.ok) {
      throw new UpstreamError(vendor, `${vendor} responded ${res.status}`, res.status);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    const reason = e instanceof Error ? e.message : "request failed";
    throw new UpstreamError(vendor, `${vendor} request failed: ${reason}`);
  } finally {
    clearTimeout(timeout);
  }
}
