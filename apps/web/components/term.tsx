"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getGlossaryAction, type GlossaryTerm } from "@/app/(authed)/glossary-actions";

/**
 * Inline glossary tooltips. A <GlossaryProvider> (mounted once in the authed
 * layout) loads the term library a single time; <Term> then turns any piece of
 * jargon into a hover/tap-to-define hint. Non-advisory: definitions explain what
 * a term means, never what to do. Graceful by design — until the library loads,
 * or for any unknown term, <Term> renders its text plainly with no decoration.
 */

function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type GlossaryMap = Map<string, GlossaryTerm>;
const GlossaryContext = createContext<GlossaryMap | null>(null);

export function GlossaryProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<GlossaryMap | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await getGlossaryAction();
      if (!active || !res.ok) return;
      const m: GlossaryMap = new Map();
      for (const entry of res.terms) {
        for (const key of [entry.term, ...entry.keys]) {
          const norm = normalizeKey(key);
          if (norm && !m.has(norm)) m.set(norm, entry);
        }
      }
      setMap(m);
    })();
    return () => {
      active = false;
    };
  }, []);

  return <GlossaryContext.Provider value={map}>{children}</GlossaryContext.Provider>;
}

/**
 * <Term>Stop loss</Term>            — key derived from the visible text
 * <Term k="REBUY_WATCH">Rebuy Watch</Term> — explicit lookup key (e.g. an enum)
 */
export function Term({ k, children }: { k?: string; children: ReactNode }) {
  const map = useContext(GlossaryContext);
  const [open, setOpen] = useState(false);

  const lookupKey = k ?? (typeof children === "string" ? children : "");
  const entry = useMemo(
    () => (map && lookupKey ? map.get(normalizeKey(lookupKey)) : undefined),
    [map, lookupKey],
  );

  // Unknown term or library not loaded yet → plain text, no decoration.
  if (!entry) return <>{children}</>;

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={`${entry.term}: ${entry.short}`}
        aria-expanded={open}
        className="cursor-help border-b border-dotted border-neutral-400 outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-50 mb-1 block w-64 rounded-md border border-neutral-200 bg-white p-2.5 text-left text-xs font-normal leading-snug text-neutral-700 shadow-lg"
        >
          <span className="mb-0.5 block font-semibold text-neutral-900">{entry.term}</span>
          <span className="block">{entry.short}</span>
          {entry.full && <span className="mt-1 block text-neutral-500">{entry.full}</span>}
        </span>
      )}
    </span>
  );
}
