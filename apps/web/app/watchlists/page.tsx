import { apiFetch } from "@/lib/api";
import {
  CreateWatchlistForm,
  WatchlistCard,
  type Watchlist,
} from "@/components/watchlists-ui";

export const dynamic = "force-dynamic"; // personalized — never statically cached

export default async function WatchlistsPage() {
  let watchlists: Watchlist[] | null = null;
  let error: string | null = null;
  try {
    watchlists = await apiFetch<Watchlist[]>("/api/v1/watchlists");
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load watchlists";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Watchlists</h1>
      </div>

      <CreateWatchlistForm />

      {/* Error is distinct from empty — never mask a failed fetch. */}
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load your watchlists: {error}
        </div>
      ) : !watchlists || watchlists.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-neutral-500">
          No watchlists yet. Create one above to start tracking US stocks and ETFs.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {watchlists.map((w) => (
            <WatchlistCard key={w.id} watchlist={w} />
          ))}
        </div>
      )}
    </div>
  );
}
