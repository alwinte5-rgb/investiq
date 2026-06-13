"use server";

import { apiFetch } from "@/lib/api";

// Mirrors the shared GlossaryTerm shape. Web never imports @investiq/shared at
// runtime (it consumes the API), so the type is declared locally.
export interface GlossaryTerm {
  term: string;
  keys: string[];
  short: string;
  full?: string;
}

export type GlossaryActionResult =
  | { ok: true; terms: GlossaryTerm[] }
  | { ok: false; error: string };

/** Fetch the full glossary once. Static reference data — small and cacheable client-side. */
export async function getGlossaryAction(): Promise<GlossaryActionResult> {
  try {
    const terms = await apiFetch<GlossaryTerm[]>("/api/v1/glossary");
    return { ok: true, terms };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load glossary" };
  }
}
