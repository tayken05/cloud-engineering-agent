import Link from "next/link";
import type { ReactNode } from "react";

export function AuthCard({
  eyebrow,
  title,
  description,
  children,
  footer,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}>) {
  return (
    <div className="auth-page">
      <section className="auth-card" aria-labelledby="auth-heading">
        <div className="auth-brand-mark" aria-hidden="true">CE</div>
        <header className="auth-heading">
          <p className="eyebrow">{eyebrow}</p>
          <h1 id="auth-heading">{title}</h1>
          <p>{description}</p>
        </header>
        {children}
        {footer ? <div className="auth-footer">{footer}</div> : null}
        <Link className="auth-home-link" href="/">Return to the public dashboard</Link>
      </section>
    </div>
  );
}
