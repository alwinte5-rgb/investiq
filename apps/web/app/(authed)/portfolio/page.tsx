import { redirect } from "next/navigation";

// The stock portfolio view was retired in the forex refactor.
export default function PortfolioPage() {
  redirect("/dashboard");
}
