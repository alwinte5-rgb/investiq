import { redirect } from "next/navigation";

// The stock opportunities feed was retired in the forex refactor.
export default function OpportunitiesPage() {
  redirect("/dashboard");
}
