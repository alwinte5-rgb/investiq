"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

function handle(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : "Request failed";
  if (/authentication required|\b401\b/i.test(msg)) redirect("/sign-in");
  return { ok: false, error: msg };
}

export async function updateUserAction(
  id: string,
  patch: { plan?: string; role?: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await apiFetch(`/api/v1/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}

export async function toggleFlagAction(
  key: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await apiFetch(`/api/v1/admin/flags/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return handle(e);
  }
}
