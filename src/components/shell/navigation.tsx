"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationGroups, sections } from "@/lib/workspace";

type NavigationProps = { label: string; onNavigate?: () => void };

export function Navigation({ label, onNavigate }: NavigationProps) {
  const pathname = usePathname();

  function isCurrent(href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  }

  return (
    <nav aria-label={label} className="navigation">
      {navigationGroups.map((group) => (
        <div className="nav-group" key={group}>
          <p className="nav-label">{group}</p>
          <ul>
            {sections.filter((section) => section.group === group).map((section) => (
              <li key={section.href}>
                <Link
                  href={section.href}
                  aria-current={isCurrent(section.href) ? "page" : undefined}
                  onClick={onNavigate}
                  className="nav-link"
                >
                  <span className="nav-marker" aria-hidden="true" />
                  {section.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
