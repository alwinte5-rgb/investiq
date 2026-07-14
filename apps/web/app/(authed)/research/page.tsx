import { redirect } from "next/navigation";

// Stock research was retired in the forex refactor. Old bookmarks land on the
// Trade Calculator — the product's new center of gravity.
export default function ResearchPage() {
  redirect("/calculator");
}
