import { Redirect } from "expo-router";

/**
 * Reviews were merged into Home (the daily briefing now lives on the dashboard),
 * mirroring the web IA. The review backend is unchanged — only this page is gone.
 * Kept as a redirect so any saved deep links still resolve.
 */
export default function ReviewsScreen() {
  return <Redirect href="/" />;
}
