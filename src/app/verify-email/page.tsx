import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { requestEmailVerificationAction } from "@/server/auth/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify owner email | Cloud Engineering Agent", referrer: "no-referrer" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return (
    <AuthCard
      eyebrow="Email ownership"
      title="Verify your email"
      description="Request a time-limited verification link for the existing owner account. This does not register a new user or grant owner access."
      footer={<><span>Already verified?</span><Link href="/sign-in">Return to sign in</Link></>}
    >
      {query.requested ? <p className="auth-notice auth-notice-success" role="status">If the address requires verification, an email has been sent. Check the inbox and spam folder.</p> : null}
      {query.error ? <p className="auth-notice auth-notice-error" role="alert">{query.error === "invalid" ? "Enter a valid email address." : "Email verification is temporarily unavailable. Please try again shortly."}</p> : null}
      <form action={requestEmailVerificationAction} className="auth-form" aria-label="Request email verification link">
        <div className="auth-field">
          <label htmlFor="verification-email">Email address</label>
          <input id="verification-email" name="email" type="email" inputMode="email" autoComplete="email" maxLength={320} placeholder="owner@example.com" required />
          <span className="auth-field-hint">For privacy, the page never confirms whether an address is registered.</span>
        </div>
        <AuthSubmitButton idle="Send verification link" pending="Sending securely…" />
      </form>
    </AuthCard>
  );
}
