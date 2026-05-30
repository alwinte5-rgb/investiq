/** Surface Clerk's user-facing message without leaking internals. */
export function clerkError(e: unknown): string {
  const err = e as { errors?: Array<{ message?: string; longMessage?: string }> };
  return (
    err?.errors?.[0]?.longMessage ??
    err?.errors?.[0]?.message ??
    (e instanceof Error ? e.message : "Something went wrong")
  );
}
