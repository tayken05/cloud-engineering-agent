"use server";

import { redirect } from "next/navigation";

import { getAuth } from "./auth";

function safeReturnTo(value: FormDataEntryValue | null): string {
  return typeof value === "string" && /^\/(ideas|studio)(?:[/?].*)?$/.test(value) ? value : "/ideas";
}

export async function signInAction(formData: FormData): Promise<never> {
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")).trim().slice(0, 320) : "";
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")).slice(0, 1024) : "";
  const returnTo = safeReturnTo(formData.get("returnTo"));
  if (!email || !password) redirect(`/auth/sign-in?error=invalid&returnTo=${encodeURIComponent(returnTo)}`);
  try {
    const result = await getAuth().signIn.email({ email, password });
    if (result.error || !result.data) redirect(`/auth/sign-in?error=invalid&returnTo=${encodeURIComponent(returnTo)}`);
  } catch {
    redirect(`/auth/sign-in?error=unavailable&returnTo=${encodeURIComponent(returnTo)}`);
  }
  redirect(returnTo);
}

export async function signOutAction(): Promise<never> {
  try { await getAuth().signOut(); } finally { redirect("/auth/sign-in?signedOut=1"); }
}
