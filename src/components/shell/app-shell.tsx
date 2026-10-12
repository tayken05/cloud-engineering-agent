import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/workspace/icon";
import { Header } from "./header";
import { Navigation } from "./navigation";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Cloud Engineering Agent home">
          <span className="brand-icon"><Icon /></span>
          <span>
            Cloud Engineering
            <span className="brand-subtitle">Intelligence workspace</span>
          </span>
        </Link>
        <Navigation label="Desktop workspace" />
        <div className="sidebar-footer">
          <span className="status-dot" aria-hidden="true" />
          <span>
            Foundation phase
            <span className="footer-detail">Integrations not connected</span>
          </span>
        </div>
      </aside>
      <div className="workspace">
        <Header />
        <main id="main-content" tabIndex={-1} className="main-content">{children}</main>
        <footer className="workspace-footer">
          Cloud Engineering Intelligence &amp; X Content Platform
          <span>Research thoughtfully. Teach clearly.</span>
        </footer>
      </div>
    </div>
  );
}
