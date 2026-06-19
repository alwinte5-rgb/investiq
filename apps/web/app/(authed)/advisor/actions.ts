"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

export type AdvisorActionResult = { ok: true; answer: string } | { ok: false; error: string };

/** Ask the non-advisory AI Advisor. Grounded in the user's own data server-side. */
export async function askAdvisorAction(question: string): Promise<AdvisorActionResult> {
  const q = question.trim();
  if (q.length < 3) return { ok: false, error: "Ask a question (a few words)." };
  try {
    const { answer } = await apiFetch<{ answer: string }>("/api/v1/advisor", {
      method: "POST",
      body: JSON.stringify({ question: q }),
    });
    return { ok: true, answer };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Advisor unavailable";
    if (/authentication required|unauthorized|\b401\b/i.test(msg)) redirect("/sign-in");
    return { ok: false, error: msg };
  }
}
