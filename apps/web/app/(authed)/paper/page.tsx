import { redirect } from "next/navigation";

// Stock paper trading was retired in the forex refactor. Plan trades without
// risking money in the Trade Planner instead.
export default function PaperPage() {
  redirect("/planner");
}
