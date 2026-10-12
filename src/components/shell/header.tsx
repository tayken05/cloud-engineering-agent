"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";
import { sections } from "@/lib/workspace";
import { Navigation } from "./navigation";
import { ThemeControl } from "./theme-control";

export function Header() {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const title = sections.find((section) => section.href === pathname)?.title ?? "Page not found";

  function closeMenu() {
    if (menu.current) menu.current.open = false;
    summary.current?.focus();
  }

  return (
    <header className="top-header">
      <div className="header-row">
        <div>
          <p className="eyebrow header-eyebrow">Cloud Engineering Agent</p>
          <p className="current-page">{title}</p>
        </div>
        <ThemeControl />
      </div>
      <details
        key={pathname}
        ref={menu}
        className="mobile-menu"
        onKeyDown={(event) => { if (event.key === "Escape") closeMenu(); }}
      >
        <summary ref={summary}>
          Workspace navigation <span aria-hidden="true">⌄</span>
        </summary>
        <Navigation label="Mobile workspace" onNavigate={closeMenu} />
      </details>
    </header>
  );
}
