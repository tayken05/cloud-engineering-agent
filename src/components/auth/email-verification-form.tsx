"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  requestEmailVerificationCodeAction,
  type EmailVerificationActionState,
  verifyEmailCodeAction,
} from "@/server/auth/actions";
import { EMAIL_VERIFICATION } from "@/server/auth/recovery-policy";

const initialState: EmailVerificationActionState = { status: "idle", message: "" };

export function EmailVerificationForm() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);
  const [requestState, requestAction, requestPending] = useActionState(requestEmailVerificationCodeAction, initialState);
  const [verificationState, verificationAction, verificationPending] = useActionState(verifyEmailCodeAction, initialState);

  useEffect(() => {
    if (!requestState.sentAt) return;
    const cooldownUntil = requestState.sentAt + EMAIL_VERIFICATION.resendCooldownSeconds * 1_000;
    const update = () => setCooldown(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1_000)));
    update();
    codeInput.current?.focus();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [requestState.sentAt]);

  if (verificationState.status === "verified") {
    return (
      <div className="auth-recovery-block">
        <p className="auth-notice auth-notice-success" role="status">{verificationState.message}</p>
        <Link className="auth-inline-button" href="/forgot-password">Set or reset password</Link>
        <p className="auth-security-note">Owner workspace access still requires the exact configured owner identity.</p>
      </div>
    );
  }

  const requestSucceeded = requestState.status === "sent";
  const requestFailed = requestState.status === "invalid" || requestState.status === "error";
  const verificationFailed = verificationState.status === "invalid" || verificationState.status === "error";

  return (
    <div className="auth-verification-flow">
      <form action={requestAction} className="auth-form" aria-label="Request email verification code">
        <div className="auth-field">
          <label htmlFor="verification-email">Email address</label>
          <input
            id="verification-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={320}
            placeholder="owner@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={requestPending || verificationPending}
            required
          />
          <span className="auth-field-hint">For privacy, the response never confirms whether an address is registered.</span>
        </div>
        <button className="auth-submit" type="submit" disabled={requestPending || verificationPending || cooldown > 0}>
          {requestPending ? <span className="auth-spinner" aria-hidden="true" /> : null}
          {requestPending ? "Sending securely…" : cooldown > 0 ? `Resend in ${cooldown}s` : requestSucceeded ? "Resend verification code" : "Send verification code"}
        </button>
      </form>

      {requestSucceeded ? <p className="auth-notice auth-notice-success" role="status">{requestState.message}</p> : null}
      {requestFailed ? <p className="auth-notice auth-notice-error" role="alert">{requestState.message}</p> : null}

      <div className="auth-flow-divider"><span>Enter the code</span></div>

      <form action={verificationAction} className="auth-form" aria-label="Verify email code">
        <input type="hidden" name="email" value={email} />
        <div className="auth-field">
          <label htmlFor="verification-code">Six-digit verification code</label>
          <input
            ref={codeInput}
            className="auth-code-input"
            id="verification-code"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            minLength={EMAIL_VERIFICATION.codeLength}
            maxLength={EMAIL_VERIFICATION.codeLength}
            placeholder="000000"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, EMAIL_VERIFICATION.codeLength))}
            aria-describedby="verification-code-guidance"
            disabled={requestPending || verificationPending}
            required
          />
          <span className="auth-field-hint" id="verification-code-guidance">Codes expire after {EMAIL_VERIFICATION.expiresInMinutes} minutes. Request a new code if this one has expired.</span>
        </div>
        <button className="auth-submit" type="submit" disabled={requestPending || verificationPending || otp.length !== EMAIL_VERIFICATION.codeLength || !email.trim()}>
          {verificationPending ? <span className="auth-spinner" aria-hidden="true" /> : null}
          {verificationPending ? "Verifying securely…" : "Verify email"}
        </button>
      </form>

      {verificationFailed ? <p className="auth-notice auth-notice-error" role="alert">{verificationState.message}</p> : null}
      <p className="auth-security-note">Code requests and verification attempts are rate limited by managed Neon Auth. This page also enforces a one-minute resend cooldown.</p>
    </div>
  );
}
