import type { Config } from "tailwindcss";

/** Token-driven theme: all colors reference the CSS vars in globals.css, which
 * flip with the `.dark` class — so components written with token classes
 * (bg-surface, text-t1, border-edge, text-pos…) are theme-correct without
 * per-component dark: variants. */
export default {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        raised: "var(--raised)",
        edge: "var(--edge)",
        "edge-strong": "var(--edge-strong)",
        t1: "var(--t1)",
        t2: "var(--t2)",
        t3: "var(--t3)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        "accent-fg": "var(--accent-fg)",
        pos: "var(--pos)",
        neg: "var(--neg)",
        warn: "var(--warn)",
        "pos-soft": "var(--pos-soft)",
        "neg-soft": "var(--neg-soft)",
        "warn-soft": "var(--warn-soft)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      // Bare `border` (no color) is used all over the legacy components;
      // defaulting it to the edge token makes them theme-correct for free.
      borderColor: {
        DEFAULT: "var(--edge)",
      },
    },
  },
  plugins: [],
} satisfies Config;
