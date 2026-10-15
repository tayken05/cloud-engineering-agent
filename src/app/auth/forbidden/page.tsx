import type { Metadata } from "next";
import Link from "next/link";

import { signOutAction } from "@/server/auth/actions";

export const metadata: Metadata = { title: "Access denied | Cloud Engineering Agent" };

export default function ForbiddenPage() {
  return <main className="auth-page"><section className="auth-card"><p className="eyebrow">Owner workspace</p><h1>Access denied</h1><p>This authenticated account is not the configured owner identity.</p><form action={signOutAction}><button className="primary-action" type="submit">Sign out</button></form><Link href="/">Return to the public dashboard</Link></section></main>;
}
