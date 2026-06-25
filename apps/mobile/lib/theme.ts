/**
 * Shared design tokens — the mobile twin of the web "AI Financial Co-Pilot"
 * design system (#45). Navy/slate base with sparing accent colors:
 *   green = opportunity · amber = watch-out · red = risk · blue = neutral/info.
 * Centralized so every screen stays consistent and a palette tweak is one edit.
 */

export const colors = {
  // Slate base (Tailwind slate scale)
  ink: "#0f172a", // slate-900 — headings
  slate800: "#1e293b",
  slate700: "#334155",
  slate600: "#475569",
  slate500: "#64748b", // muted body
  slate400: "#94a3b8", // faint / captions
  slate300: "#cbd5e1",
  slate200: "#e2e8f0", // borders
  slate100: "#f1f5f9",
  slate50: "#f8fafc", // tinted surfaces
  white: "#ffffff",

  // Accents
  blue: "#2563eb",
  blue700: "#1d4ed8",
  blue50: "#eff6ff",
  blue200: "#bfdbfe",
  green: "#059669", // emerald-600
  green700: "#047857",
  green50: "#ecfdf5",
  amber: "#d97706", // amber-600
  amber700: "#b45309",
  amber50: "#fffbeb",
  red: "#dc2626",
  red700: "#b91c1c",
  red50: "#fef2f2",
} as const;

export type Tone = "green" | "amber" | "red" | "blue" | "slate";

/** Tone → strong text color (big numbers, verbs). */
export const toneText: Record<Tone, string> = {
  green: colors.green,
  amber: colors.amber,
  red: colors.red,
  blue: colors.blue,
  slate: colors.ink,
};

/** Tone → status dot color. */
export const toneDot: Record<Tone, string> = {
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
  slate: colors.slate400,
};

/** Tone → soft badge background + text (ring-style pills). */
export const toneBadge: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: colors.green50, fg: colors.green700 },
  amber: { bg: colors.amber50, fg: colors.amber700 },
  red: { bg: colors.red50, fg: colors.red700 },
  blue: { bg: colors.blue50, fg: colors.blue700 },
  slate: { bg: colors.slate100, fg: colors.slate600 },
};

/** 0–100 score → tone (mirrors web scoreTone). */
export function scoreTone(v: number | null): Tone {
  if (v == null) return "slate";
  if (v >= 80) return "green";
  if (v >= 60) return "blue";
  if (v >= 40) return "amber";
  return "red";
}

/** Brokerage warning color → tone. */
export const warningTone: Record<string, Tone> = {
  GREEN: "green",
  YELLOW: "amber",
  ORANGE: "amber",
  RED: "red",
};
