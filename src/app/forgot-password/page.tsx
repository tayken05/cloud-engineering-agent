import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { requestPasswordSetupAction } from "@/server/auth/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set or reset password | Cloud Engineering Agent", referrer: "no-referrer" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return (
    <AuthCard
      eyebrow="Secure account recovery"
      title="Set or reset your password"
      description="Enter the owner account email. If it is eligible, Neon Auth will send a time-limited password setup link."
      footer={<><span>Already completed this step?</span><Link href="/sign-in">Return to sign in</Link></>}
    >
      {query.requested ? <p className="auth-notice auth-notice-success" role="status">If the address is eligible, a password setup email has been sent. Check the inbox and spam folder.</p> : null}
      {query.error ? <p className="auth-notice auth-notice-error" role="alert">{query.error === "invalid" ? "Enter a valid email address." : "The recovery service is temporarily unavailable. Please try again shortly."}</p> : null}
      <form action={requestPasswordSetupAction} className="auth-form" aria-label="Request password setup link">
        <div className="auth-field">
          <label htmlFor="recovery-email">Email address</label>
          <input id="recovery-email" name="email" type="email" inputMode="email" autoComplete="email" maxLength={320} placeholder="owner@example.com" required />
          <span className="auth-field-hint">The response is intentionally identical whether or not an account exists.</span>
        </div>
        <AuthSubmitButton idle="Send password setup link" pending="Sending securely…" />
      </form>
    </AuthCard>
  );
}
