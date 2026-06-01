"use client";

import { useState, useTransition } from "react";
import { toggleFlagAction, updateUserAction } from "./actions";

const PLANS = ["FREE", "INVESTOR", "INVESTOR_PLUS"];
const ROLES = ["USER", "ADMIN"];

export function FlagToggle({ flagKey, enabled }: { flagKey: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  const [on, setOn] = useState(enabled);
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !on;
          setOn(next);
          const res = await toggleFlagAction(flagKey, next);
          if (!res.ok) setOn(!next); // revert on failure
        })
      }
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        on ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"
      } disabled:opacity-50`}
    >
      {on ? "Enabled" : "Disabled"}
    </button>
  );
}

export function UserControls({
  id,
  plan,
  role,
}: {
  id: string;
  plan: string;
  role: string;
}) {
  const [pending, start] = useTransition();
  const update = (patch: { plan?: string; role?: string }) =>
    start(async () => {
      await updateUserAction(id, patch);
    });
  return (
    <span className="flex gap-2">
      <select
        defaultValue={plan}
        disabled={pending}
        onChange={(e) => update({ plan: e.target.value })}
        className="rounded border px-1 py-0.5 text-xs"
      >
        {PLANS.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
      <select
        defaultValue={role}
        disabled={pending}
        onChange={(e) => update({ role: e.target.value })}
        className="rounded border px-1 py-0.5 text-xs"
      >
        {ROLES.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
    </span>
  );
}
