"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Sidebar navigation for the trading command center.
 *
 * Desktop: fixed left rail with grouped sections + active highlighting.
 * Mobile: a horizontally scrollable strip under the header (same links,
 * flattened) so nothing is more than one tap away. */

const SECTIONS: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: "Trading",
    items: [
      { href: "/dashboard", label: "Overview" },
      { href: "/bots", label: "Bots" },
      { href: "/options", label: "Options" },
      { href: "/futures", label: "Futures" },
      { href: "/forex", label: "Forex" },
      { href: "/crypto", label: "Crypto" },
    ],
  },
  {
    label: "Research",
    items: [
      { href: "/ideas", label: "Ideas" },
      { href: "/research", label: "Lab Results" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/calculator", label: "Calculator" },
      { href: "/planner", label: "Planner" },
      { href: "/journal", label: "Journal" },
      { href: "/calendar", label: "Calendar" },
      { href: "/sessions", label: "Sessions" },
      { href: "/pairs", label: "Pairs" },
      { href: "/learn", label: "Learn" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/alpaca", label: "Alpaca" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function SidebarNav() {
  const pathname = usePathname() ?? "";
  return (
    <>
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-[calc(100vh-49px)] w-52 shrink-0 overflow-y-auto border-r border-edge px-3 py-5 lg:block">
        <nav className="space-y-6">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-t3">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={
                          active
                            ? "block rounded-md bg-raised px-2 py-1.5 text-sm font-medium text-accent"
                            : "block rounded-md px-2 py-1.5 text-sm text-t2 hover:bg-raised hover:text-t1"
                        }
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile strip */}
      <nav className="flex gap-1 overflow-x-auto border-b border-edge px-3 py-2 lg:hidden">
        {SECTIONS.flatMap((s) => s.items).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? "whitespace-nowrap rounded-full bg-raised px-3 py-1 text-xs font-medium text-accent"
                  : "whitespace-nowrap rounded-full px-3 py-1 text-xs text-t2 hover:bg-raised"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
