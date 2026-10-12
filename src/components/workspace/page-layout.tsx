import type { ReactNode } from "react";

type PageLayoutProps = {
  title: string;
  description: string;
  eyebrow?: string;
  children: ReactNode;
};

export function PageLayout({ title, description, eyebrow = "Workspace", children }: PageLayoutProps) {
  return (
    <div className="page-layout">
      <div className="page-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children}
    </div>
  );
}
