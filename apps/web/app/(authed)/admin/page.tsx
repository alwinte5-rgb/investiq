import { apiFetch } from "@/lib/api";
import { FlagToggle, UserControls } from "./admin-ui";

export const dynamic = "force-dynamic";

interface Overview {
  users: number;
  plans: { FREE: number; INVESTOR: number; INVESTOR_PLUS: number };
  connections: number;
  watchlists: number;
}
interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  role: string;
  _count: { watchlists: number; brokerageConnections: number };
}
interface Flag {
  id: string;
  key: string;
  enabled: boolean;
  rolloutPct: number;
}

export default async function AdminPage() {
  let overview: Overview | null = null;
  let users: AdminUser[] = [];
  let flags: Flag[] = [];
  let denied = false;
  try {
    [overview, users, flags] = await Promise.all([
      apiFetch<Overview>("/api/v1/admin/overview"),
      apiFetch<AdminUser[]>("/api/v1/admin/users"),
      apiFetch<Flag[]>("/api/v1/admin/flags"),
    ]);
  } catch (e) {
    denied = /forbidden|admin/i.test(e instanceof Error ? e.message : "");
  }

  if (denied) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Admin access required. Your account is not an administrator.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Admin</h1>

      {overview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Users", overview.users],
            ["Brokerage links", overview.connections],
            ["Watchlists", overview.watchlists],
            ["Investor+", overview.plans.INVESTOR + overview.plans.INVESTOR_PLUS],
          ].map(([label, val]) => (
            <div key={label} className="rounded-md border p-3">
              <div className="text-xs text-neutral-500">{label}</div>
              <div className="text-lg font-semibold">{val}</div>
            </div>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Users</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Watchlists</th>
                <th className="px-3 py-2">Plan / Role</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2 text-neutral-500">{u._count.watchlists}</td>
                  <td className="px-3 py-2">
                    <UserControls id={u.id} plan={u.plan} role={u.role} />
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-neutral-500">
                    No users.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Feature flags</h2>
        {flags.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No flags yet — toggling one below creates it.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {flags.map((f) => (
              <li key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-mono">{f.key}</span>
                <FlagToggle flagKey={f.key} enabled={f.enabled} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
