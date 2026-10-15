# Owner authentication

Task 12 uses the existing managed Neon Auth service through `@neondatabase/auth`. The application is an API-only Next.js client of that managed service; it does not host, reset, or migrate a separate Better Auth server. Managed tables remain in `neon_auth` and are outside Drizzle's application schema.

## Access model

Authentication proves the session identity. Authorization separately requires the session's stable user ID to exactly match server-only `OWNER_AUTH_USER_ID`. The comparison occurs in the private page boundary and again before every content query or mutation. An authenticated user who is not the configured owner cannot read or write private records. Missing Auth or owner configuration fails closed.

Public registration through the application Auth route is disabled. The public dashboard, Sources, Stories & News, Jobs, job detail pages, and Learning Series remain available. `/ideas` and `/studio` require the owner session.

## Production owner enrollment and recovery

Production has `NEON_AUTH_BASE_URL`, a production-only `NEON_AUTH_COOKIE_SECRET`, and the explicitly selected owner's stable ID in `OWNER_AUTH_USER_ID`. The managed catalog contains one unbanned user. That user was created in the Neon console with a credential account but no password, and its email has not yet been verified.

The application uses the managed Better Auth recovery APIs rather than creating a second user or writing `neon_auth` directly:

1. `/forgot-password` requests a time-limited password-reset email. Completing the link creates the missing credential password on the existing user.
2. `/verify-email` requests the six-digit email OTP supported by Neon's shared provider. The owner enters the code in the application, which calls `emailOtp.verifyEmail` for the same existing account.
3. `/sign-in` accepts the verified account and established password. Successful authentication is still followed by the exact stable-ID owner check before `/ideas`, `/studio`, or any private query/action can run.

Both request forms return the same message for registered, unknown, and already-completed addresses. Verification codes expire after 15 minutes. The page enforces a 60-second resend cooldown, while managed Auth applies the authoritative send and verification rate limits. Public registration remains disabled. The password recovery callback is fixed server-side to `https://cloud-engineering-agent.vercel.app`; a user cannot supply an arbitrary redirect.

The canonical production origin is registered in the managed Auth domain configuration for the Neon project and was verified through Neon's official CLI before enabling the recovery UI.

The password page requires 12–128 characters and confirmation, does not log or retain the password, and sends it only to managed Neon Auth. Reset tokens are bounded, single-use provider tokens. Verification accepts exactly six ASCII digits and never logs or persists the code. Auth pages are dynamically rendered; the reset page applies a no-referrer policy. Neon Auth's built-in origin/CSRF validation and Next.js Server Action origin checks remain enabled.

Do not store the ID in `NEXT_PUBLIC_*`, commit it, or use email matching as the authorization boundary.

## Development limitation

The isolated development database is verified at endpoint `ep-sweet-bread-b72xtg4u`, but an independent managed Auth endpoint for that branch could not be verified. Local private routes therefore fail closed. Provision or verify a branch-specific managed Auth endpoint before setting local `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, and `OWNER_AUTH_USER_ID`; never reuse the production Auth endpoint for development testing.

## Credential follow-up

A development database credential appeared in a prior diagnostic exception. Coordinate its rotation through Neon and every dependent integration. Do not rotate a shared role in only one environment, and never paste replacement values into source control, task reports, or client-side variables.
