import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic"; // personalized — never statically cached

interface Me {
  userId: string;
  plan: "FREE" | "INVESTOR" | "INVESTOR_PLUS";
  role: "USER" | "ADMIN";
}

export default async function DashboardPage() {
  let me: Me | null = null;
  let error: string | null = null;
  try {
    me = await apiFetch<Me>("/api/v1/me");
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Error state is distinct from empty — never mask a failed fetch. */}
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn’t load your account: {error}
        </div>
      ) : me ? (
        <div className="rounded-md border p-4 text-sm">
          <div className="flex justify-between border-b py-2">
            <span className="text-neutral-500">Plan</span>
            <span className="font-medium">{me.plan}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-neutral-500">Role</span>
            <span className="font-medium">{me.role}</span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-neutral-500">Loading…</div>
      )}

      <p className="text-xs text-neutral-400">
        Portfolio summary, watchlists, and AI research arrive in Layer 1+.
      </p>
    </div>
  );
}
