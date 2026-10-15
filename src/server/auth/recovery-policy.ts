const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;
const EMAIL_OTP_PATTERN = /^\d{6}$/;

export const EMAIL_VERIFICATION = Object.freeze({
  codeLength: 6,
  expiresInMinutes: 15,
  resendCooldownSeconds: 60,
});

export const AUTH_CALLBACKS = Object.freeze({
  passwordReset: "https://cloud-engineering-agent.vercel.app/reset-password",
});

export function normalizeEmail(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 320 && EMAIL_PATTERN.test(email) ? email : null;
}

export function normalizeResetToken(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return RESET_TOKEN_PATTERN.test(token) ? token : null;
}

export function normalizeEmailOtp(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const otp = value.trim();
  return EMAIL_OTP_PATTERN.test(otp) ? otp : null;
}

export function validateNewPassword(password: string, confirmation: string): "password" | "mismatch" | null {
  if (password.length < 12 || password.length > 128) return "password";
  if (password !== confirmation) return "mismatch";
  return null;
}
