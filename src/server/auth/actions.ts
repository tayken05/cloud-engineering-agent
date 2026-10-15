"use server";

import { redirect } from "next/navigation";

import { getAuth } from "./auth";
import {
  AUTH_CALLBACKS,
  normalizeEmail,
  normalizeEmailOtp,
  normalizeResetToken,
  validateNewPassword,
} from "./recovery-policy";

export type EmailVerificationActionState = Readonly<{
  status: "idle" | "sent" | "verified" | "invalid" | "error";
  message: string;
  sentAt?: number;
}>;

function safeReturnTo(value: FormDataEntryValue | null): string {
  return typeof value === "string" && /^\/(ideas|studio)(?:[/?].*)?$/.test(value) ? value : "/ideas";
}

export async function signInAction(formData: FormData): Promise<never> {
  const email = normalizeEmail(formData.get("email"));
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")).slice(0, 1024) : "";
  const returnTo = safeReturnTo(formData.get("returnTo"));
  if (!email || !password) redirect(`/sign-in?error=invalid&returnTo=${encodeURIComponent(returnTo)}`);
  let accepted = false;
  try {
    const result = await getAuth().signIn.email({ email, password });
    accepted = !result.error && Boolean(result.data);
  } catch {
    redirect(`/sign-in?error=unavailable&returnTo=${encodeURIComponent(returnTo)}`);
  }
  if (!accepted) redirect(`/sign-in?error=invalid&returnTo=${encodeURIComponent(returnTo)}`);
  redirect(returnTo);
}

export async function signOutAction(): Promise<never> {
  try { await getAuth().signOut(); } finally { redirect("/sign-in?signedOut=1"); }
}

export async function requestPasswordSetupAction(formData: FormData): Promise<never> {
  const email = normalizeEmail(formData.get("email"));
  if (!email) redirect("/forgot-password?error=invalid");
  let accepted = false;
  try {
    const result = await getAuth().requestPasswordReset({
      email,
      redirectTo: AUTH_CALLBACKS.passwordReset,
    });
    accepted = !result.error;
  } catch {
    redirect("/forgot-password?error=unavailable");
  }
  if (!accepted) redirect("/forgot-password?error=unavailable");
  redirect("/forgot-password?requested=1");
}

export async function requestEmailVerificationCodeAction(
  _previousState: EmailVerificationActionState,
  formData: FormData,
): Promise<EmailVerificationActionState> {
  const email = normalizeEmail(formData.get("email"));
  if (!email) return { status: "invalid", message: "Enter a valid email address." };
  let accepted = false;
  try {
    const result = await getAuth().emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    accepted = !result.error && result.data?.success === true;
  } catch {
    return { status: "error", message: "A code could not be sent. Wait one minute before trying again." };
  }
  if (!accepted) return { status: "error", message: "A code could not be sent. Wait one minute before trying again." };
  return {
    status: "sent",
    message: "If the address is eligible, a six-digit verification code has been sent. Check the inbox and spam folder.",
    sentAt: Date.now(),
  };
}

export async function verifyEmailCodeAction(
  _previousState: EmailVerificationActionState,
  formData: FormData,
): Promise<EmailVerificationActionState> {
  const email = normalizeEmail(formData.get("email"));
  const otp = normalizeEmailOtp(formData.get("otp"));
  if (!email) return { status: "invalid", message: "Enter the same valid email address that received the code." };
  if (!otp) return { status: "invalid", message: "Enter the six-digit code from the verification email." };
  try {
    const result = await getAuth().emailOtp.verifyEmail({ email, otp });
    if (result.error || result.data?.status !== true) {
      return { status: "invalid", message: "The code could not be verified. It may be invalid or expired. Request a new code and try again." };
    }
  } catch {
    return { status: "error", message: "Email verification is temporarily unavailable. Please try again shortly." };
  }
  return { status: "verified", message: "Email verified successfully. Complete password setup for future sign-ins." };
}

export async function resetPasswordAction(formData: FormData): Promise<never> {
  const token = normalizeResetToken(formData.get("token"));
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
  const confirmation = typeof formData.get("confirmation") === "string" ? String(formData.get("confirmation")) : "";
  const passwordError = validateNewPassword(password, confirmation);
  if (!token) redirect("/reset-password?error=invalid-token");
  if (passwordError) redirect(`/reset-password?token=${encodeURIComponent(token)}&error=${passwordError}`);
  let accepted = false;
  try {
    const result = await getAuth().resetPassword({ newPassword: password, token });
    accepted = !result.error && result.data?.status === true;
  } catch {
    redirect("/reset-password?error=unavailable");
  }
  if (!accepted) redirect("/reset-password?error=invalid-token");
  redirect("/sign-in?passwordReset=1");
}
