import { redirect } from "next/navigation";

// Watchlists have been folded into Opportunities (which surfaces the same
// "stocks to track" information without duplication). Any bookmark or stale link
// to /watchlists now lands on Opportunities. The watchlist API/data remain
// intact server-side, so this is reversible if we ever bring the page back.
export default function WatchlistsPage() {
  redirect("/opportunities");
}
