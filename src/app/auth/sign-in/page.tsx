import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { PasswordField } from "@/components/auth/password-field";
import { signInAction } from "@/server/auth/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Owner sign in | Cloud Engineering Agent" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const returnTo = typeof query.returnTo === "string" ? query.returnTo : "/ideas";
  const error = typeof query.error === "string" ? query.error : null;
  return (
    <AuthCard
      eyebrow="Private owner workspace"
      title="Welcome back"
      description="Sign in with the verified owner account to manage ideas, drafts, revisions, and visual specifications."
      footer={<><span>Need to finish account setup?</span><Link href="/forgot-password">Set or reset password</Link><Link href="/verify-email">Verify email</Link></>}
    >
        {query.signedOut ? <p className="auth-notice auth-notice-success" role="status">You have signed out securely.</p> : null}
        {query.passwordReset ? <p className="auth-notice auth-notice-success" role="status">Your password has been updated. Verify your email if needed, then sign in.</p> : null}
        {query.verified ? <p className="auth-notice auth-notice-success" role="status">Your email has been verified. You can now sign in.</p> : null}
        {error ? <p className="auth-notice auth-notice-error" role="alert">{error === "configuration" ? "Owner authentication setup is incomplete." : error === "unavailable" ? "Authentication is temporarily unavailable. Please try again shortly." : error === "TOKEN_EXPIRED" || error === "INVALID_TOKEN" ? "That verification link is invalid or has expired. Request a new verification email." : "The email or password was not accepted. If setup is incomplete, use the recovery links below."}</p> : null}
        <form action={signInAction} className="auth-form" aria-label="Owner sign in">
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="auth-field">
            <label htmlFor="owner-email">Email address</label>
            <input id="owner-email" name="email" type="email" inputMode="email" autoComplete="username" maxLength={320} placeholder="owner@example.com" required />
          </div>
          <PasswordField label="Password" name="password" autoComplete="current-password" confirm />
          <AuthSubmitButton idle="Sign in securely" pending="Signing in…" />
        </form>
        <p className="auth-security-note">Access is limited to the configured owner identity. Registration is not available.</p>
    </AuthCard>
  );
}
