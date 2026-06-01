"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function run(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    revalidatePath("/watchlists");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    // Session expired mid-action (middleware doesn't fire on server actions) —
    // send the user to sign in rather than showing a confusing inline error.
    if (/authentication required|unauthorized|\b401\b/i.test(msg)) {
      redirect("/sign-in");
    }
    return { ok: false, error: msg };
  }
}

export async function createWatchlistAction(name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required" };
  return run(() =>
    apiFetch("/api/v1/watchlists", { method: "POST", body: JSON.stringify({ name: trimmed }) }),
  );
}

export async function deleteWatchlistAction(id: string): Promise<ActionResult> {
  return run(() => apiFetch(`/api/v1/watchlists/${id}`, { method: "DELETE" }));
}

export async function addItemAction(
  watchlistId: string,
  ticker: string,
): Promise<ActionResult> {
  const t = ticker.trim().toUpperCase();
  if (!t) return { ok: false, error: "Ticker is required" };
  return run(() =>
    apiFetch(`/api/v1/watchlists/${watchlistId}/items`, {
      method: "POST",
      body: JSON.stringify({ ticker: t }),
    }),
  );
}

export async function removeItemAction(
  watchlistId: string,
  itemId: string,
): Promise<ActionResult> {
  return run(() =>
    apiFetch(`/api/v1/watchlists/${watchlistId}/items/${itemId}`, { method: "DELETE" }),
  );
}
