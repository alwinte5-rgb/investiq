"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

function isAuthError(msg: string) {
  return /authentication required|unauthorized|\b401\b/i.test(msg);
}

/** Start a SnapTrade connection and return the portal URL for the client to open. */
export async function connectBrokerageAction(): Promise<{ portalUrl?: string; error?: string }> {
  try {
    const { portalUrl } = await apiFetch<{ portalUrl: string; connectionId: string }>(
      "/api/v1/connections",
      { method: "POST" },
    );
    return { portalUrl };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to start connection";
    if (isAuthError(msg)) redirect("/sign-in");
    return { error: msg };
  }
}

/** Load the read-only sample-data portfolio (explore before connecting a broker). */
export async function loadDemoPortfolioAction(): Promise<{ ok: boolean; error?: string }> {
  try {
    await apiFetch("/api/v1/connections/demo", { method: "POST" });
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load sample data";
    if (isAuthError(msg)) redirect("/sign-in");
    return { ok: false, error: msg };
  }
}

/** Remove a connection (used to clear the demo portfolio). */
export async function removeConnectionAction(
  connectionId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await apiFetch(`/api/v1/connections/${connectionId}`, { method: "DELETE" });
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to remove";
    if (isAuthError(msg)) redirect("/sign-in");
    return { ok: false, error: msg };
  }
}

/** Sync holdings/transactions for a connection (or the user's only one). */
export async function syncBrokerageAction(
  connectionId: string,
): Promise<{ ok: boolean; error?: string; warning?: string }> {
  try {
    const res = await apiFetch<{ holdingsErrors: number }>(
      `/api/v1/connections/${connectionId}/sync`,
      { method: "POST" },
    );
    revalidatePath("/dashboard");
    const warning =
      res.holdingsErrors > 0
        ? "Synced, but your broker couldn't return holdings for an account yet — it may still be preparing. Try again shortly."
        : undefined;
    return { ok: true, warning };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    if (isAuthError(msg)) redirect("/sign-in");
    return { ok: false, error: msg };
  }
}
