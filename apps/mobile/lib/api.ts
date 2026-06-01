import Constants from "expo-constants";

const API_BASE_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

/**
 * Mobile API client. Caller supplies the Clerk token (from useAuth().getToken).
 * Same backend + same response contract as web.
 */
export async function apiFetch<T>(
  path: string,
  token: string | null,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  if (body.data === undefined) throw new Error("Unexpected empty response from API");
  return body.data;
}
