"use server";

import { redirect } from "next/navigation";

import { getAuth } from "./auth";
import {
  AUTH_CALLBACKS,
  normalizeEmail,
  normalizeResetToken,
  validateNewPassword,
} from "./recovery-policy";

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

export async function requestEmailVerificationAction(formData: FormData): Promise<never> {
  const email = normalizeEmail(formData.get("email"));
  if (!email) redirect("/verify-email?error=invalid");
  let accepted = false;
  try {
    const result = await getAuth().sendVerificationEmail({
      email,
      callbackURL: AUTH_CALLBACKS.emailVerified,
    });
    accepted = !result.error;
  } catch {
    redirect("/verify-email?error=unavailable");
  }
  if (!accepted) redirect("/verify-email?error=unavailable");
  redirect("/verify-email?requested=1");
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
