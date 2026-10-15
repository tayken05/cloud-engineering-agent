const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;

export const AUTH_CALLBACKS = Object.freeze({
  passwordReset: "https://cloud-engineering-agent.vercel.app/reset-password",
  emailVerified: "https://cloud-engineering-agent.vercel.app/sign-in?verified=1",
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

export function validateNewPassword(password: string, confirmation: string): "password" | "mismatch" | null {
  if (password.length < 12 || password.length > 128) return "password";
  if (password !== confirmation) return "mismatch";
  return null;
}
