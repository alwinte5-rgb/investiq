"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  addItemAction,
  createWatchlistAction,
  deleteWatchlistAction,
  removeItemAction,
} from "@/app/watchlists/actions";

export interface SymbolResult {
  ticker: string;
  name: string;
  assetType: "STOCK" | "ETF";
  exchange: string | null;
  sector: string | null;
}

export interface WatchlistItem {
  id: string;
  note: string | null;
  symbol: { ticker: string; name: string; assetType: "STOCK" | "ETF" };
}

export interface Watchlist {
  id: string;
  name: string;
  items: WatchlistItem[];
}

/** Debounced symbol typeahead hitting the BFF search route. */
function SymbolSearch({ onPick }: { onPick: (ticker: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SymbolResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/symbols/search?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        const body = (await res.json()) as { data?: SymbolResult[]; error?: string };
        if (!res.ok) throw new Error(body.error ?? "Search failed");
        setResults(body.data ?? []);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Search failed");
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div ref={boxRef} className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Add a US stock or ETF…"
        className="w-full rounded-md border px-3 py-1.5 text-sm"
      />
      {q.trim() && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-sm">
          {loading ? (
            <div className="px-3 py-2 text-xs text-neutral-500">Searching…</div>
          ) : error ? (
            <div className="px-3 py-2 text-xs text-red-600">{error}</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-neutral-500">No matches</div>
          ) : (
            results.map((r) => (
              <button
                key={r.ticker}
                onClick={() => {
                  onPick(r.ticker);
                  setQ("");
                  setResults([]);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50"
              >
                <span>
                  <span className="font-medium">{r.ticker}</span>{" "}
                  <span className="text-neutral-500">{r.name}</span>
                </span>
                <span className="rounded-full border px-2 py-0.5 text-[10px] text-neutral-500">
                  {r.assetType}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function CreateWatchlistForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (!name.trim()) return;
    start(async () => {
      const res = await createWatchlistAction(name);
      if (res.ok) setName("");
      else setError(res.error ?? "Failed");
    });
  }

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="New watchlist name"
          className="w-full rounded-md border px-3 py-1.5 text-sm"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <button
        onClick={submit}
        disabled={pending || !name.trim()}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create"}
      </button>
    </div>
  );
}

export function WatchlistCard({ watchlist }: { watchlist: Watchlist }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add(ticker: string) {
    start(async () => {
      const res = await addItemAction(watchlist.id, ticker);
      if (!res.ok) setError(res.error ?? "Failed to add");
      else setError(null);
    });
  }
  function remove(itemId: string) {
    start(async () => {
      const res = await removeItemAction(watchlist.id, itemId);
      if (!res.ok) setError(res.error ?? "Failed to remove");
    });
  }
  function destroy() {
    start(async () => {
      const res = await deleteWatchlistAction(watchlist.id);
      if (!res.ok) setError(res.error ?? "Failed to delete");
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{watchlist.name}</h3>
        <button
          onClick={destroy}
          disabled={pending}
          className="text-xs text-neutral-400 hover:text-red-600 disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      <SymbolSearch onPick={add} />
      {error && <p className="text-xs text-red-600">{error}</p>}

      {watchlist.items.length === 0 ? (
        <p className="text-xs text-neutral-500">No symbols yet — search above to add one.</p>
      ) : (
        <ul className="divide-y text-sm">
          {watchlist.items.map((it) => (
            <li key={it.id} className="flex items-center justify-between py-2">
              <span>
                <span className="font-medium">{it.symbol.ticker}</span>{" "}
                <span className="text-neutral-500">{it.symbol.name}</span>
              </span>
              <button
                onClick={() => remove(it.id)}
                disabled={pending}
                className="text-xs text-neutral-400 hover:text-red-600 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
