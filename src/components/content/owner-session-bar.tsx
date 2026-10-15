import { signOutAction } from "@/server/auth/actions";

export function OwnerSessionBar() {
  return <aside className="operator-notice"><div><strong>Authenticated owner workspace</strong><p>Ideas, drafts, revision history, and visual specifications are stored privately in PostgreSQL and checked against the configured owner identity.</p></div><form action={signOutAction}><button className="secondary-action" type="submit">Sign out</button></form></aside>;
}
