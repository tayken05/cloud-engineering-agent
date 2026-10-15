"use client";

import { useId, useState } from "react";

type PasswordFieldProps = Readonly<{
  label: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  confirm?: boolean;
}>;

export function PasswordField({ label, name, autoComplete, hint, confirm = false }: PasswordFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password-control">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={confirm ? undefined : 12}
          maxLength={128}
          aria-describedby={hint ? hintId : undefined}
          required
        />
        <button
          type="button"
          className="auth-password-toggle"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint ? <span className="auth-field-hint" id={hintId}>{hint}</span> : null}
    </div>
  );
}
