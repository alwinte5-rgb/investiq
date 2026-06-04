"use client";

import { useState, useTransition } from "react";
import {
  connectBrokerageAction,
  loadDemoPortfolioAction,
  removeConnectionAction,
  syncBrokerageAction,
} from "./actions";

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

export function ReconnectButton({ label = "Reconnect" }: { label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reconnect() {
    setError(null);
    start(async () => {
      const res = await connectBrokerageAction();
      if (res.portalUrl) window.location.href = res.portalUrl;
      else setError(res.error ?? "Failed to start reconnect");
    });
  }

  return (
    <span>
      <button
        onClick={reconnect}
        disabled={pending}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Starting…" : label}
      </button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function DisconnectButton({ connectionId }: { connectionId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function disconnect() {
    setError(null);
    start(async () => {
      const res = await removeConnectionAction(connectionId);
      if (!res.ok) setError(res.error ?? "Failed to disconnect");
    });
  }

  return (
    <span>
      <button
        onClick={disconnect}
        disabled={pending}
        className="rounded-md border px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
      >
        {pending ? "Removing…" : "Disconnect"}
      </button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function DemoButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    start(async () => {
      const res = await loadDemoPortfolioAction();
      if (!res.ok) setError(res.error ?? "Failed to load sample data");
      // On success the action revalidates /dashboard, refreshing this view.
    });
  }

  return (
    <div className="space-y-2">
      <button
        onClick={load}
        disabled={pending}
        className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
      >
        {pending ? "Loading…" : "Try with sample data"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function RemoveDemoButton({ connectionId }: { connectionId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    start(async () => {
      const res = await removeConnectionAction(connectionId);
      if (!res.ok) setError(res.error ?? "Failed to remove");
    });
  }

  return (
    <span>
      <button
        onClick={remove}
        disabled={pending}
        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
      >
        {pending ? "Removing…" : "Remove sample data"}
      </button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function SyncButton({ connectionId }: { connectionId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  function sync() {
    setError(null);
    setWarning(null);
    start(async () => {
      const res = await syncBrokerageAction(connectionId);
      if (!res.ok) setError(res.error ?? "Sync failed");
      else if (res.warning) setWarning(res.warning);
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
      {warning && <span className="ml-2 text-xs text-amber-600">{warning}</span>}
    </span>
  );
}
