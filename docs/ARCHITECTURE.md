# Architecture

Status: application shell deployed; the initial database migration is validated on development and production; Task 5 implements the first database-backed feature, the read-only Technology Sources Catalog. Ingestion and the remaining product workflows remain planned.

## Current application

- Next.js 16 App Router with React and strict TypeScript on Node.js 24 LTS.
- Development and production build use Next.js's supported Webpack mode. Tailwind CSS uses its official PostCSS plugin and root `postcss.config.mjs`.
- npm provides dependency management; `package-lock.json` is committed for reproducible installs with `npm ci`.
- `src/app/` holds the shared root layout, twelve explicit routes, and global Tailwind CSS with light/dark design tokens.
- `@/*` resolves to `src/*`.
- Root configuration contains Next.js, TypeScript, and ESLint settings.
- `docs/` contains product requirements, roadmap, architecture, and decisions. Root `AGENTS.md` governs coding-agent work.
- The dashboard is a static introduction to the four pillars. The `/sources` route lists approved public source metadata from PostgreSQL; the other ten feature routes remain descriptive empty states. Automated research, content, engagement, private-data workflows, authentication, and jobs remain planned.

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

## Database foundation — Tasks 4A through 4B.9

Drizzle ORM 0.45.4, Drizzle Kit 0.31.11, and `server-only` 0.0.1 define a PostgreSQL/Neon-compatible model in `src/server/db/`. Four tables cover sources, collected source items, stories, and many-to-many story evidence. Actual foreign keys/unique/check constraints accompany typed Drizzle relationships. UUIDs, timezone-aware provenance timestamps, optional primary topics, operational/retry fields, and verification details prepare the intelligence model without implementing ingestion.

`src/server/db/index.ts` remains the server-only database boundary. The raw schema stays pure for migration tooling, and the lazy environment reader validates `DATABASE_URL` only when called. `src/server/db/client.ts` creates a Neon HTTP/Drizzle client per requested operation with an eight-second abort signal; it creates no module-initialization connection. Only the Sources Server Component reaches the query layer, and no database module is imported by Client Components.

`drizzle.config.ts` deliberately omits credentials. `db:generate` and `db:check` run offline; generated SQL, snapshot, and journal live in `drizzle/`. `.env.example` contains empty pooled `DATABASE_URL` and direct `DATABASE_URL_UNPOOLED` placeholders, with only that example exempted from environment-file exclusions. Real local values remain in ignored `.env.local`. No migration runs during startup, builds, or Vercel deployment, and no schema synchronization is configured.

Task 4B.4 validated that both local URLs resolve to the expected development endpoint and `neondb`, then ran the same fixed `SELECT` in read-only transactions through pooled and direct HTTPS connections. Task 4B.5 revalidated that boundary, inspected the empty `public` schema, and used only the direct connection with Drizzle's transactional Neon serverless migrator to apply `0000_initial_intelligence.sql` to development. Catalog comparison, 13 rolled-back integration scenarios, and a repeat invocation verified the resulting schema, constraints, history, and idempotent no-op behavior. Provider-managed `neon_auth` objects were untouched, and the four application tables remain empty. These were temporary administrative verification paths, not application behavior. See `docs/DATABASE.md` for exact results and limits.

Task 4B.9 adds a manual production migration boundary without adding runtime data access. A dedicated script accepts only an ignored, permission-restricted production credential file and an exact direct-endpoint allowlist. Its preflight path uses read-only transactions. Its execution path requires both an explicit `--execute` invocation and an exact interactive confirmation, pins one acquired connection to `public`, and applies only the checksum-locked migration through Drizzle's transactional PostgreSQL migrator. Install, build, start, application imports, and Vercel deployment do not call this script.

The application owns the new objects in `public` and the migration record in `drizzle`; Neon owns `neon_auth`. The production runner requires the verified nine-table authentication baseline and compares authentication catalog fingerprints around migration. It contains no authentication DDL or DML. Endpoint-to-branch ownership must still be reverified through Neon metadata immediately before a future authorized execution because PostgreSQL cannot attest a Neon branch name from SQL alone.

Task 4B.10 executed the initial production migration through this boundary. The resulting schema matches the development-tested artifact: 4 application tables, 58 columns, 6 enums, 4 primary keys, 5 unique constraints, 16 checks, 3 restrictive foreign keys, 17 indexes, and one matching Drizzle history row. Task 5 subsequently inserted the approved 11-row source catalog in both environments. The other three application tables remain empty, the managed `neon_auth` catalog is unchanged, and ingestion and authentication integration remain unimplemented.

## Technology Sources Catalog — Task 5

- `/sources` is a request-rendered Server Component. Next.js `connection()` prevents the query and environment access from running during static generation or a production build.
- `src/server/sources/list-sources.ts` owns the read query. It exposes only public catalog fields, validates filters before query construction, uses parameterized Drizzle expressions, caps results at 100, and converts failures to a credential-free error state.
- Search, topic, source-type, and enabled-status filters use GET parameters and native accessible controls. The catalog has responsive result and empty states. It displays no reliability score, freshness claim, item statistics, or fabricated content.
- The first version deliberately does not cache results. Each incoming request reads the current catalog; this behavior is documented in code and database documentation.
- Catalog population remains separate administrative tooling. Exact development and production direct-endpoint allowlists, migration-history checks, conflict detection, insert-only transactions, and production interactive confirmation protect the operation. No route, Server Action, or API handler can write sources.
- Eleven registered first-party sources cover AWS, Azure, Google Cloud, Linux, networking, Kubernetes/cloud native, DevOps, infrastructure as code, cybersecurity, software engineering, and AI infrastructure. Registration identifies provenance; it does not verify every item a publisher may publish.

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

Neon PostgreSQL stores the applied schema and initial source catalog on both isolated development and production `main`. Drizzle implements schema, migrations, and the single bounded source read query. Additional runtime access remains separately gated. OpenAI API is the AI direction. Vercel hosts the application. Official X API access is conditional on feasibility. Scheduled and durable processing, Telegram Bot API, and Browser Push API remain future directions.

## Security and project separation

Keep secrets outside source control and server-side; ignore environment files, private keys, local credential directories, and provider state. Add safe placeholder environment examples only when an integration is authorized. The Cloud Engineering Agent and Football X Agent must have separate repositories, data, content memory, credentials, and service configuration.

## Verification strategy

Run `npm run lint`, `npm run typecheck`, and `npm run build` after changes. Confirm development startup, HTTP success for all twelve routes, active navigation, mobile menu operation, theme persistence/system appearance, and responsive rendering. `tests/shell.test.mjs` uses Node's built-in runner for HTTP route/landmark checks and unknown-route behavior against a running local server (`npm run test:shell`, default port 3100). Use browser automation for shell interactions; no additional test-framework dependency is installed. Add durable behavior tests alongside future business features. Do not suppress errors, ignore build failures, or add assertions that merely mirror implementation.
