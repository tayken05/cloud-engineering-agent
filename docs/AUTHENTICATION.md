# Owner authentication

Task 12 uses the existing managed Neon Auth service through `@neondatabase/auth`. The application is an API-only Next.js client of that managed service; it does not host, reset, or migrate a separate Better Auth server. Managed tables remain in `neon_auth` and are outside Drizzle's application schema.

## Access model

Authentication proves the session identity. Authorization separately requires the session's stable user ID to exactly match server-only `OWNER_AUTH_USER_ID`. The comparison occurs in the private page boundary and again before every content query or mutation. An authenticated user who is not the configured owner cannot read or write private records. Missing Auth or owner configuration fails closed.

Public registration through the application Auth route is disabled. The public dashboard, Sources, Stories & News, Jobs, job detail pages, and Learning Series remain available. `/ideas` and `/studio` require the owner session.

## Production owner enrollment

Production already has the managed `NEON_AUTH_BASE_URL` and a generated production-only `NEON_AUTH_COOKIE_SECRET`. Complete the one-time enrollment as follows:

1. Create or approve the intended owner account through the Neon project's managed Auth administration workflow. Do not use an arbitrary first-user rule.
2. Copy the account's stable managed-auth user ID from Neon. Verify the identity using the project owner's chosen email/account before continuing.
3. Add that exact value to the existing Vercel project as a Production Secret named `OWNER_AUTH_USER_ID`.
4. Redeploy the current reviewed commit so the new server-only variable is available.
5. Sign in at `/auth/sign-in`; confirm `/ideas` and `/studio` load, an invalid password fails, sign-out clears the session, and a different authenticated user reaches `/auth/forbidden`.

Do not store the ID in `NEXT_PUBLIC_*`, commit it, or use email matching as the authorization boundary.

## Development limitation

The isolated development database is verified at endpoint `ep-sweet-bread-b72xtg4u`, but an independent managed Auth endpoint for that branch could not be verified. Local private routes therefore fail closed. Provision or verify a branch-specific managed Auth endpoint before setting local `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, and `OWNER_AUTH_USER_ID`; never reuse the production Auth endpoint for development testing.

## Credential follow-up

A development database credential appeared in a prior diagnostic exception. Coordinate its rotation through Neon and every dependent integration. Do not rotate a shared role in only one environment, and never paste replacement values into source control, task reports, or client-side variables.
