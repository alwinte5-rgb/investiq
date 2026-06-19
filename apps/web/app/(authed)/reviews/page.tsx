import { redirect } from "next/navigation";

// Reviews are now shown on Home (the Reviews page was removed). Old bookmarks /
// links to /reviews land on Home, where the full briefing lives. The review
// API/engine remain — Home consumes them.
export default function ReviewsPage() {
  redirect("/dashboard");
}
