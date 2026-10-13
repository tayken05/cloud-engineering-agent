# Architecture

Status: application shell deployed; Task 4A database schema/migrations exist locally without a database connection. Product workflows remain planned. Product domains and integrations described as planned below are not implemented.

## Current application

- Next.js 16 App Router with React and strict TypeScript on Node.js 24 LTS.
- Development and production build use Next.js's supported Webpack mode. Tailwind CSS uses its official PostCSS plugin and root `postcss.config.mjs`.
- npm provides dependency management; `package-lock.json` is committed for reproducible installs with `npm ci`.
- `src/app/` holds the shared root layout, twelve explicit routes, and global Tailwind CSS with light/dark design tokens.
- `@/*` resolves to `src/*`.
- Root configuration contains Next.js, TypeScript, and ESLint settings.
- `docs/` contains product requirements, roadmap, architecture, and decisions. Root `AGENTS.md` governs coding-agent work.
- The dashboard is a static introduction to the four pillars. Eleven other routes provide descriptive empty states; no research, content, engagement, or private-data workflows are implemented. API integrations, authentication, live database access, and jobs remain planned.

## Implemented application shell

- `src/components/shell/`: Server Component `AppShell`, with client `Header`, `Navigation`, and `ThemeControl` for pathname awareness and browser preferences.
- `src/components/workspace/`: shared Server Components `PageLayout`, `FeaturePage`, and decorative SVG `Icon`; dashboard cards are server-rendered.
- `src/lib/workspace.ts`: typed presentation catalog for navigation labels, groups, and empty-state descriptions. No provider or business logic.
- Explicit routes: `/`, `/tech-hub`, `/trending`, `/stories`, `/ideas`, `/studio`, `/learning-series`, `/posts`, `/inbox`, `/analytics`, `/sources`, `/settings`. Feature pages delegate to `FeaturePage` and have individual metadata.
- Desktop sidebar at widths of 1024px and above; native expandable mobile navigation below that breakpoint, with Escape dismissal and closure after link activation. Dashboard cards become one column below 640px.
- Semantic header/navigation/main/footer, a skip link, visible keyboard focus, labelled theme selector, and `aria-current` active navigation indicators.
- Appearance offers system/light/dark, follows system changes, persists a validated preference under `cloud-agent-theme-v1`, and synchronizes across tabs. Blocked storage falls back to in-memory preferences. A small static head script resolves the theme before paint; hydration suppression is limited to the expected root theme-attribute difference. CSS honors system appearance even without JavaScript.
- The hub is a public placeholder without private information. Authentication must precede private-data functionality. Theme preference is local browser UI state, not an account setting.

## Production hosting — Task 3B

- Public production URL: https://cloud-engineering-agent.vercel.app.
- Vercel project `cloud-engineering-agent` in personal Hobby scope `tayken05s-projects`; linked to private GitHub repository `tayken05/cloud-engineering-agent`.
- Git production branch: `main`. The configuration commit triggered a production deployment automatically from GitHub, confirming private-repository access. Other branches retain Vercel's default preview behavior; no preview branch deployment has been created or tested in this task.
- Repository root is the build root. `vercel.json` records Next.js, `npm ci`, and `npm run build`; the existing build script selects Webpack. Vercel project settings use Node.js `24.x`, and deployed function metadata confirms `nodejs24.x`. Vercel controls patch updates within that major.
- No application environment variables or external integrations are configured. CLI linking generated an OIDC credential in ignored `.env.local`; `.vercel/` is also ignored. Neither is committed or uploaded through Git.
- The canonical production domain is public. Team, branch, and immutable deployment aliases may require Vercel Authentication; keep deployment protection intact and use authorized Vercel tooling when necessary.
- No paid plan, add-on, database, AI service, or application authentication was added. The public hub remains an empty placeholder, without private information.
- Git-based documentation/configuration updates must be committed and pushed normally, then verified against the resulting production commit. No force-push or history rewrite.

## Local database foundation — Task 4A

Drizzle ORM 0.45.4, Drizzle Kit 0.31.11, and `server-only` 0.0.1 define a PostgreSQL/Neon-compatible model in `src/server/db/`. Four tables cover sources, collected source items, stories, and many-to-many story evidence. Actual foreign keys/unique/check constraints accompany typed Drizzle relationships. UUIDs, timezone-aware provenance timestamps, optional primary topics, operational/retry fields, and verification details prepare the intelligence model without implementing ingestion.

`src/server/db/index.ts` is the server-only entry point. The raw schema remains pure for migration tooling, and the lazy environment reader validates a planned `DATABASE_URL` only when called. No driver, connection factory, module-initialization connection, ORM queries, Neon project, or application database variables exist. The UI imports none of this database code.

`drizzle.config.ts` deliberately omits credentials. `db:generate` and `db:check` run offline; generated SQL, snapshot, and journal live in `drizzle/`. `.env.example` contains an empty `DATABASE_URL`, with only that example exempted from environment-file exclusions. No migration runs during startup, builds, or Vercel deployment, and no schema synchronization is configured.

See `docs/DATABASE.md` for the model, deduplication/verification limits, indexes, retention decisions, and future authorized migration workflow. The initial SQL has been generated and structurally checked, not executed against PostgreSQL or Neon. Task 4A changes are local and have not been pushed or deployed.

## Planned module boundaries

Create modules only when an authorized feature needs them. The following boundaries are design guidance, not directories to scaffold now:

| Boundary | Responsibilities |
| --- | --- |
| UI and route layer | Pages, layouts, components, presentation, accessible interaction |
| Business logic | Research verification, content categories, review rules, conversation behavior, analytics definitions |
| Data access | Database queries, transactions, migrations, persistence boundaries |
| External integrations | Provider-specific clients, API permissions, response validation, rate limits |
| Background processing | Scheduling, durable execution, retries, idempotency, concurrency control |

UI components must not embed database queries or provider-specific business rules. Data access and external clients remain server-side. Introduce abstractions only for demonstrated needs.

## Server and Client Component boundaries

Use Server Components by default. Add Client Components only for browser state, event handling, or browser APIs. Never pass secrets through props, rendered HTML, browser bundles, or `NEXT_PUBLIC_*` variables. Validate untrusted input at server boundaries and validate provider responses before relying on them.

Future private routes and actions require server-side authorization before accessing private hub data, preferences, bookmarks, inboxes, or content memory. Hiding UI is not an access-control mechanism.

## Planned domains and flows

Verified intelligence: trusted sources → bounded ingestion → normalization and duplicate detection → evidence and verification → private feeds/bookmarks/digests or human-selected public content opportunities.

Educational content: verified research → independently categorized Style A or Style B, or another defined content type → AI-assisted draft when authorized → human review → manual X publishing → published post tracking → content memory and analytics.

Engagement: authorized X data where feasible → conversation hubs and Shared Inbox → conversation intelligence → AI reply suggestions → human review and manual action.

Notifications: authorized application event → durable notification job → preference and consent checks → Telegram or Browser Push delivery → observable delivery result.

These flows are proposals; no ingestion, AI generation, publishing, engagement, or notification flow exists in Task 1.

## Reliability and provenance

- Await critical promises and handle failures explicitly; use `async/await` with appropriate error handling, bounded timeouts, and cancellation.
- Plan background jobs with transient-failure retries, backoff, idempotency, controlled concurrency, and observable terminal failures.
- Preserve original links and separate publication, retrieval, and verification timestamps. Use timezone-aware timestamps and apply the user's timezone for display.
- Keep verification status, uncertainty, duplicate relationships, and corrections auditable. Do not present inferred or AI-generated claims as verified facts.
- Apply provider rate limits and permissions; do not assume a specific scheduled/durable processing provider before evaluating requirements.

## Planned technology choices

Neon PostgreSQL remains the planned live persistence provider; Drizzle schema and migration declarations are implemented locally. OpenAI API is the AI direction. Vercel is the hosting direction. Official X API access is conditional on feasibility. Scheduled and durable processing, Telegram Bot API, and Browser Push API are future integration directions. None is installed, configured, or provisioned during Task 1.

## Security and project separation

Keep secrets outside source control and server-side; ignore environment files, private keys, local credential directories, and provider state. Add safe placeholder environment examples only when an integration is authorized. The Cloud Engineering Agent and Football X Agent must have separate repositories, data, content memory, credentials, and service configuration.

## Verification strategy

Run `npm run lint`, `npm run typecheck`, and `npm run build` after changes. Confirm development startup, HTTP success for all twelve routes, active navigation, mobile menu operation, theme persistence/system appearance, and responsive rendering. `tests/shell.test.mjs` uses Node's built-in runner for HTTP route/landmark checks and unknown-route behavior against a running local server (`npm run test:shell`, default port 3100). Use browser automation for shell interactions; no additional test-framework dependency is installed. Add durable behavior tests alongside future business features. Do not suppress errors, ignore build failures, or add assertions that merely mirror implementation.
