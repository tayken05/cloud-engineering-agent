import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { EmailVerificationForm } from "@/components/auth/email-verification-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify owner email | Cloud Engineering Agent", referrer: "no-referrer" };

export default function VerifyEmailPage() {
  return (
    <AuthCard
      eyebrow="Email ownership"
      title="Verify your email"
      description="Request the six-digit code supported by Neon's shared email provider, then enter it below. This does not register a new user or grant owner access."
      footer={<><span>Already verified?</span><Link href="/sign-in">Return to sign in</Link></>}
    >
      <EmailVerificationForm />
    </AuthCard>
  );
}
