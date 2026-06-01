"use client";

import { useState, useTransition } from "react";
import { connectBrokerageAction, syncBrokerageAction } from "./actions";

export function ConnectButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function connect() {
    setError(null);
    start(async () => {
      const res = await connectBrokerageAction();
      if (res.portalUrl) window.location.href = res.portalUrl; // open SnapTrade portal
      else setError(res.error ?? "Failed to start connection");
    });
  }

  return (
    <div className="space-y-2">
      <button
        onClick={connect}
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Starting…" : "Connect a brokerage account"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function SyncButton({ connectionId }: { connectionId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function sync() {
    setError(null);
    start(async () => {
      const res = await syncBrokerageAction(connectionId);
      if (!res.ok) setError(res.error ?? "Sync failed");
    });
  }

  return (
    <span>
      <button
        onClick={sync}
        disabled={pending}
        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
      >
        {pending ? "Syncing…" : "Sync holdings"}
      </button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </span>
  );
}
