import type { Metadata } from "next";
import Link from "next/link";

import { signInAction } from "@/server/auth/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Owner sign in | Cloud Engineering Agent" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const returnTo = typeof query.returnTo === "string" ? query.returnTo : "/ideas";
  const error = typeof query.error === "string" ? query.error : null;
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="sign-in-heading">
        <p className="eyebrow">Private owner workspace</p>
        <h1 id="sign-in-heading">Sign in</h1>
        <p>Use the owner account configured through managed Neon Auth. Registration does not grant workspace access.</p>
        {query.signedOut ? <p className="studio-alert status-safe">You have signed out.</p> : null}
        {error ? <p className="studio-alert" role="alert">{error === "configuration" ? "Owner authentication setup is incomplete." : error === "unavailable" ? "Authentication is temporarily unavailable." : "The email or password was not accepted."}</p> : null}
        <form action={signInAction} className="auth-form">
          <input type="hidden" name="returnTo" value={returnTo} />
          <label>Email<input name="email" type="email" autoComplete="username" maxLength={320} required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" maxLength={1024} required /></label>
          <button className="primary-action" type="submit">Sign in securely</button>
        </form>
        <Link href="/">Return to the public dashboard</Link>
      </section>
    </main>
  );
}
