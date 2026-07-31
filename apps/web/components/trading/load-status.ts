import { apiFetch } from "@/lib/api";
import type { QuantStatus } from "./types";

/** Server-side snapshot fetch shared by every trading page. quant-lab's cron
 * pushes its status to the API every ~5 min (secret-authed); this reads the
 * latest snapshot. Null on any failure — pages render their empty states
 * rather than crashing. */
export async function loadQuantStatus(): Promise<QuantStatus> {
  try {
    const snapshot = await apiFetch<{ data: QuantStatus; updatedAt: string } | null>(
      "/api/v1/quant-lab/snapshot",
    );
    return snapshot?.data ?? null;
  } catch {
    return null;
  }
}
