import { auth } from "@clerk/nextjs/server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";

/**
 * Server-side API client. Attaches the Clerk token and ALWAYS uses no-store —
 * personalized data is never cached. Returns the parsed { data } or throws.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { getToken } = await auth();
  const token = await getToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  if (body.data === undefined) {
    throw new Error("Unexpected empty response from API");
  }
  return body.data;
}
