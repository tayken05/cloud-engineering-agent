"use client";

import { useFormStatus } from "react-dom";

export function AuthSubmitButton({ idle, pending }: Readonly<{ idle: string; pending: string }>) {
  const status = useFormStatus();
  return (
    <button className="auth-submit" type="submit" disabled={status.pending} aria-disabled={status.pending}>
      {status.pending ? <span className="auth-spinner" aria-hidden="true" /> : null}
      {status.pending ? pending : idle}
    </button>
  );
}
