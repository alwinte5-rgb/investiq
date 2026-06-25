import { Redirect } from "expo-router";

/**
 * Watchlists are hidden from the app (that information now lives in Opportunities),
 * mirroring the web IA. The watchlist API/DB backend is unchanged — only this page
 * is gone. Kept as a redirect so any saved deep links still resolve.
 */
export default function WatchlistsScreen() {
  return <Redirect href="/opportunities" />;
}
