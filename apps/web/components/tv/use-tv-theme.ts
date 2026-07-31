"use client";

import { useEffect, useState } from "react";

/** TradingView widgets take a static theme at embed time, so watch the <html>
 * class (flipped by ThemeToggle) and report "dark" | "light"; consumers key
 * their embed on it to re-mount on toggle. */
export function useTvTheme(): "dark" | "light" {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setTheme(el.classList.contains("dark") ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}
