"use client";

import { useEffect, useState } from "react";

// Reads/writes the same "theme" key the no-FOUC script in layout.tsx sets on
// <html> before paint. Defaults to dark (owner preference).
export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* private mode — non-fatal */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="rounded-md border border-edge-strong px-2 py-1 text-xs text-t2 hover:bg-raised dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
    >
      {dark ? "☀ Light" : "☾ Dark"}
    </button>
  );
}
