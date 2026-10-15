import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { PasswordField } from "@/components/auth/password-field";
import { resetPasswordAction } from "@/server/auth/actions";
import { normalizeResetToken } from "@/server/auth/recovery-policy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Choose a password | Cloud Engineering Agent", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const token = normalizeResetToken(typeof query.token === "string" ? query.token : null);
  const error = typeof query.error === "string" ? query.error : null;
  return (
    <AuthCard
      eyebrow="Secure account recovery"
      title="Choose a new password"
      description="Use a unique passphrase for this private workspace. The recovery token is time limited and can be used only once."
      footer={<><span>Need a fresh link?</span><Link href="/forgot-password">Request password setup</Link></>}
    >
      {error ? <p className="auth-notice auth-notice-error" role="alert">{error === "password" ? "Use a password between 12 and 128 characters." : error === "mismatch" ? "The passwords do not match." : error === "unavailable" ? "Password setup is temporarily unavailable. Request a fresh link before trying again." : "This password setup link is invalid or has expired."}</p> : null}
      {token ? (
        <form action={resetPasswordAction} className="auth-form" aria-label="Choose new password">
          <input type="hidden" name="token" value={token} />
          <PasswordField label="New password" name="password" autoComplete="new-password" hint="Use at least 12 characters. A unique passphrase is recommended." />
          <PasswordField label="Confirm new password" name="confirmation" autoComplete="new-password" confirm />
          <AuthSubmitButton idle="Save new password" pending="Saving securely…" />
        </form>
      ) : (
        <div className="auth-recovery-block">
          <p>No valid recovery token was provided. Request a new password setup email to continue.</p>
          <Link className="auth-inline-button" href="/forgot-password">Request a new link</Link>
        </div>
      )}
      <p className="auth-security-note">Passwords are sent only to managed Neon Auth over HTTPS and are never logged or stored by this application.</p>
    </AuthCard>
  );
}
