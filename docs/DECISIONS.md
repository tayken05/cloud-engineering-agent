# Engineering Decisions

Recorded: 2026-10-12. These decisions distinguish the initialized foundation from future directions.

| ID | Decision | Status | Reason |
| --- | --- | --- | --- |
| D001 | Use the official `create-next-app` generator, stable Next.js 16, App Router, and React. | Foundation | Supported baseline without a bespoke scaffold. |
| D002 | Use strict TypeScript, ESLint, Tailwind CSS, `src/`, and `@/*`. | Foundation | Maintainable code, consistent checks, and clear source structure. |
| D003 | Use Node.js 24 LTS via existing user-level nvm; record the project runtime in `.nvmrc` and package metadata. | Foundation | Reproducibility without replacing the system Node.js 22 installation. |
| D004 | Use npm and commit `package-lock.json`; use `npm ci` for reproducible installs. | Foundation | One package manager and an auditable dependency graph. |
| D005 | Keep Task 1 limited to initialization, documentation, Git, and verification. | Foundation | Each subsequent feature needs its own authorized task and review. |
| D006 | Keep Style A and Style B independent in future content taxonomy, prompts, memory, and analytics. | Product requirement | Historical first-principles teaching and physical analogies serve distinct educational goals. |
| D007 | Maintain a private Personal Tech Intelligence Hub covering the wider industry alongside the public Cloud Engineering niche. | Planned | Private broad research and focused public education have different audiences and access boundaries. |
| D008 | Preserve source links, timestamps, evidence, verification status, duplicate relationships, and corrections. | Planned | Traceability and factual reliability must underpin intelligence and content. |
| D009 | Require human-reviewed manual X publishing; AI drafts and reply suggestions do not authorize posting. | Planned | Preserve editorial control and explicit human action. |
| D010 | Use Neon-compatible PostgreSQL schemas with Drizzle ORM. | Foundation applied to development | Schema and migration are implemented; the initial migration is applied and verified only on isolated development while production migration and application queries remain planned. |
| D011 | Consider OpenAI API. | Planned; not installed | Future research assistance, drafts, and reply suggestions. |
| D012 | Consider Vercel hosting; deployment needs explicit approval. | Planned; not configured | Future hosting direction without deployment during initialization. |
| D013 | Use the official X API where feasible; evaluate capabilities and access before implementation. | Planned; not configured | Availability and permissions must be verified before integration design. |
| D014 | Evaluate scheduled and durable processing with retries, idempotency, timeouts, cancellation, and controlled concurrency. | Planned; provider undecided | Reliable asynchronous ingestion, digests, and notification delivery. |
| D015 | Consider Telegram Bot API and Browser Push API for opt-in notifications. | Planned; not installed | Future private notification channels. |
| D016 | Keep this platform separate from the Football X Agent. | Permanent boundary | Avoid mixing product scope, data, credentials, memory, and external services. |
| D017 | Plan future Telegram and Discord engineering communities; defer their integration details. | Planned | Community work is outside the foundation task. |
| D018 | Defer test-framework dependencies until meaningful behavior requires automated tests. | Foundation | Lint, strict type checking, build, and startup verification are suitable for the empty scaffold. |
| D019 | Retain the generator's compatible ESLint 9 major and TypeScript 5 major. | Foundation; ESLint support warning | Installed `eslint-plugin-react` 7.37.5 and `eslint-plugin-jsx-a11y` 6.10.2 do not declare ESLint 10 compatibility. TypeScript ESLint 8.71.2 declares TypeScript `>=4.8.4 <6.1.0`, so the latest TypeScript major is not automatically compatible. Do not force peer conflicts or drop lint rules to upgrade. |
| D020 | Approve only the reviewed `unrs-resolver@1.12.2` install script in project-local `allowScripts`. | Foundation | npm 11 blocks unreviewed dependency scripts. This resolver script checks its platform-native binding; the macOS ARM64 binding is installed. The approval is pinned to the reviewed version and does not permit all future scripts. |
| D021 | Use supported Webpack mode for development and production builds, with Tailwind's official PostCSS integration. | Foundation | Turbopack production CSS processing failed to bind its worker port in this execution environment, including an elevated retry. `next dev --webpack` and `next build --webpack` use a supported Next.js 16 compilation path. Keep the configured commands consistent and verify their actual output. |
| D022 | Use `@neondatabase/serverless` for Neon connectivity. | Development connection and migration verified | Version 1.2.0 supports Node.js 24, one-shot HTTP queries through `neon-http`, and direct stateful sessions through `neon-serverless`; Node.js 24 supplies WebSocket support. |
| D023 | Apply reviewed SQL migrations explicitly over a direct connection, development first. | Initial development migration verified | The checked-in migration ran through Drizzle's transactional migrator using `DATABASE_URL_UNPOOLED`; no `push`, startup/build migration, pooler fallback, or production execution is allowed. |

## Known upstream tooling warning

npm marks ESLint 9.39.5 as deprecated and no longer supported. It remains the latest compatible stable ESLint 9 release selected by the official generator's configuration. This warning is not suppressed. Re-evaluate ESLint 10 when the React and accessibility lint plugins declare compatible peer dependencies, or when an authorized task adopts another fully verified official configuration. See [ESLint version support](https://eslint.org/version-support/) for the upstream support policy.

## Known upstream development-dependency advisory

The installation audit reports high-severity [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) in `braces` 3.0.3. Its installed path is `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`, within development tooling. The advisory lists no patched version, and a fresh npm registry check on 2026-10-12 confirms that 3.0.3 is still the latest release. Do not suppress the finding, force unrelated dependency upgrades, or remove official framework lint rules to hide it. Recheck upstream fixes before expanding the project or deploying it; this foundation is not a claim of production readiness.

## Dependency policy

The live audit reports five high-severity development-tool findings along this single dependency chain. Its suggested forced remediation downgrades `eslint-config-next` to 14.2.35, which does not preserve the Next.js 16 configuration baseline. The runtime-only audit (`npm audit --omit=dev`) reports zero vulnerabilities. Recheck these findings before future work; the offline install's audit summary is not a live security assessment.

Use compatible stable releases, not canary, beta, preview, or experimental releases. The lockfile records exact installed versions. Keep runtime and type definitions aligned with Node.js 24. Read current official documentation before introducing or changing framework and integration behavior. Review upgrades intentionally rather than installing unrelated dependencies.

## Task 1B dependency and tooling review — 2026-10-12

Live `npm audit --omit=dev` reports **zero vulnerabilities**. Full `npm audit` exits with status 1 and reports **five high-severity package findings from one underlying advisory**, not five independent vulnerabilities. `npm ls` and `npm explain braces` confirm the complete installed path:

`cloud-engineering-agent` → `eslint-config-next@16.4.0` → `@next/eslint-plugin-next@16.4.0` → `fast-glob@3.3.1` → `micromatch@4.0.8` → `braces@3.0.3`.

All five affected package entries belong to development lint tooling. The lockfile marks `braces` as `dev: true`; the current production server and page file traces contain none of this chain. Application source imports none of these packages and implements no user-input processing. The Next lint plugin's `getRootDirs` passes configured `settings.next.rootDir` patterns to `fast-glob`; our ESLint configuration does not set that option and uses the trusted working directory instead. There is no identified path from an HTTP user input to this vulnerable instance in the current application. Development dependencies can remain physically present in a full installation, so classification alone does not guarantee future runtime isolation. Reassess if runtime imports, deployment packaging, or untrusted glob/configuration inputs change.

The advisory describes stack-exhaustion denial of service from deeply nested brace patterns. Fresh registry metadata still lists `braces@3.0.3` as latest, and the advisory lists no patched version. Accept this temporarily for local development with trusted repository/configuration inputs. Do not force npm's proposed `eslint-config-next@14.2.35` downgrade, add unsupported overrides, or hide the audit. Review when a patched braces release or a compatible Next lint dependency chain becomes available, and before deployment.

Fresh stable registry metadata confirms these ESLint constraints:

| Package | Latest stable checked | ESLint peer range | ESLint 10 |
| --- | --- | --- | --- |
| `eslint` | 10.12.0 | Not applicable | Current major |
| `eslint-config-next` | 16.4.0 | `>=9.0.0` | Allowed directly |
| `eslint-plugin-react` | 7.37.5 | `^3 \|\| ^4 \|\| ^5 \|\| ^6 \|\| ^7 \|\| ^8 \|\| ^9.7` | Blocked |
| `eslint-plugin-jsx-a11y` | 6.10.2 | `^3 \|\| ^4 \|\| ^5 \|\| ^6 \|\| ^7 \|\| ^8 \|\| ^9` | Blocked |
| `eslint-plugin-import` | 2.32.0 | `^2 \|\| ^3 \|\| ^4 \|\| ^5 \|\| ^6 \|\| ^7.2.0 \|\| ^8 \|\| ^9` | Blocked |
| `typescript-eslint` | 8.71.2 | `^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0` | Allowed |

Installed `eslint-plugin-react-hooks@7.1.1` also permits ESLint 10; it is not a blocker. Retain ESLint 9.39.5 temporarily because no compatible stable upgrade of the complete existing plugin configuration is available. ESLint 9 reached upstream end of life on 2026-08-06: compatibility does not mean ongoing support. Track a maintenance upgrade when all three blocking plugins and the Next configuration support ESLint 10; then verify the complete peer graph and lint behavior without forcing installation.

Installed Next.js 16.4.0 documentation explicitly supports `--webpack` for both `next dev` and `next build`. Scripts consistently select it; `next.config.ts` contains a valid empty `NextConfig`, and Tailwind uses the official PostCSS integration. Keep this configuration. The prior Turbopack production panic reports CSS worker process creation → port binding → `Operation not permitted (os error 1)`, including an elevated retry, while the prior Turbopack development server served successfully. Evidence points to an execution-environment restriction in that production worker path; it does not establish a universal Turbopack defect or prove exclusivity to this environment. Retest in an ordinary macOS terminal when execution permissions or Next/Turbopack versions change, and require successful CSS processing, development serving, and production builds before switching both commands together.

Only this decisions document changes in Task 1B. Dependencies, lockfile, bundler settings, and application source remain unchanged. Local development may proceed with the documented tooling limitations; rerun live audits and reassess reachability before deployment or changes to the dependency graph.

## Official references

- [Next.js generator](https://nextjs.org/docs/app/api-reference/cli/create-next-app)
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [TypeScript configuration](https://www.typescriptlang.org/tsconfig/)
- [Node.js releases](https://nodejs.org/en/about/previous-releases)
- [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci)

Consult current provider documentation when future integrations are authorized. Listing a provider here does not install it or approve external-service changes.

## Task 2 application shell — 2026-10-12

Use explicit App Router pages with a shared typed presentation catalog, Server Component page patterns, and narrow client boundaries for navigation and browser appearance. Use native mobile disclosure navigation and a labelled system/light/dark selector instead of adding UI libraries. Theme storage contains only a validated browser-local appearance preference. The expected pre-paint theme attribute is the sole reason for root hydration suppression.

The twelve routes and introductory dashboard implement presentation only. All ingestion, AI, X, analytics, account settings, notifications, and private-data workflows remain planned. The private hub route is a placeholder without access control or private information. No dependencies or bundler commands changed; the Task 1B tooling limitations remain applicable.

Task 2 verification: all twelve routes returned HTTP 200, active navigation matched each route, and the thirteen-test built-in Node HTTP suite passed, including unknown-route 404 behavior. Headless Chrome confirmed responsive layouts at 320, 390, 768, 1024, and 1440px without horizontal overflow; mobile menu opening, Escape focus return, and closure after navigation; light/dark/system selection, reload persistence, cross-tab updates, invalid preference handling, blocked-storage fallback, and system appearance without JavaScript. Browser checks reported no console or page errors after adding the SVG application icon. Local server/browser checks required execution outside the tool sandbox because localhost binding/connections and Chrome startup were blocked there; no application workaround or system configuration change was needed. No push or deployment occurred.

## Task 3B production deployment

Use Vercel's native GitHub integration for private repository `tayken05/cloud-engineering-agent`, with `main` as production and default previews for other branches. The personal `tayken05s-projects` Hobby scope is the only available scope; the new project is `cloud-engineering-agent`, separate from existing projects. A normal main push triggered the first Git-sourced production deployment, verifying the integration rather than assuming CLI upload enables automatic releases.

Production URL: https://cloud-engineering-agent.vercel.app. Keep Next.js, root-directory builds, `npm ci`, the existing `npm run build` / Webpack script, and Node.js `24.x`; track the reproducible build commands in `vercel.json`. No application variables are required. Ignore CLI-generated `.env.local` OIDC credentials and `.vercel/` state. Never include credentials in source, deployment documentation, logs, or browser bundles.

The canonical production URL is publicly accessible; the team alias redirected to Vercel Authentication during verification. Do not disable protection to make automation pass. Preview behavior is the platform default and has not been exercised with an additional branch. No paid capacity or unrelated integrations were enabled. Re-audit and revisit the existing ESLint support and development-only braces advisory during maintenance; the production-only audit remains clear. Document updates must be pushed normally and the latest main deployment reverified before reporting completion.

Production verification passed on the canonical domain: all twelve routes returned 200, the unknown-route regression returned 404, ten HTML-referenced static assets returned 200, and CSS was applied. Headless Chrome verified active links, responsive widths from 320px to 1440px without horizontal overflow, mobile disclosure/Escape/navigation behavior, light/dark selection, reload persistence, and system-theme changes, with no console or page errors. Common `.env`, `.env.local`, `.git/config`, and `.vercel/project.json` URLs returned 404; no potential credentials were detected in fetched HTML or referenced assets. The runtime error-log query returned no logs, which is a point-in-time observation rather than a monitoring guarantee. The remote build reported the known ESLint EOL warning and five development-tool audit findings; no build failure occurred. Source and dependencies are unchanged by this deployment task.

## Task 4A offline database foundation

Use stable Drizzle ORM 0.45.4 and Drizzle Kit 0.31.11 with `server-only` 0.0.1. Current registry metadata declares no conflicting Node/Next/TypeScript peer restriction; strict compilation and actual offline generation validate this project's Node.js 24 / Next.js 16.4.0 / TypeScript 5.9.3 combination. Existing locked package versions remain unchanged. No PostgreSQL/Neon driver is needed until a connection is authorized.

Define only `sources`, `source_items`, `stories`, and `story_source_items`. Use UUID identities, PostgreSQL enums for bounded states/topics, timezone-aware timestamps, source-scoped external-ID/canonical-URL uniqueness, a stable story grouping key, and a composite evidence key. Unknown reliability/topic/publication values remain nullable; evidence links default to context and records default to unverified. Verified rows require nonblank notes and a timestamp, but supporting evidence, source independence, reviewer authorization, and verification history require future application logic. Restrictive foreign-key deletion preserves referenced evidence; updates to `updated_at` are explicit. Review identity normalization, the 2048-byte canonical-URL limit, reliability/priority scales, topic taxonomy, and retention policy before ingestion.

Keep migration declarations pure and application exports server-only. The `DATABASE_URL` reader is lazy, produces redacted errors, and does not create a connection. Generation configuration contains no credentials or environment loading; only `.env.example` is excepted from Git exclusions. SQL and Drizzle metadata are generated offline, with no migrate/push/startup synchronization scripts. PostgreSQL execution and live constraint validation are deferred; no migration has been applied anywhere.

The production-only audit reports zero vulnerabilities. Full audit reports the existing five high development-tool findings plus four moderate package findings from one [esbuild advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99): `drizzle-kit@0.31.11` → `@esbuild-kit/esm-loader@2.6.5` → `@esbuild-kit/core-utils@3.3.2` → `esbuild@0.18.20`. The vulnerable feature is esbuild's HTTP development server; the authorized commands only generate/check local files, and no esbuild server or Drizzle Studio is started. These packages are development-only and are not imported by the application. esbuild 0.25.0 fixes the advisory, but that version does not satisfy the legacy loader's esbuild dependency range. npm proposes an unrelated Drizzle Kit downgrade to 0.18.1; do not force it or add unsupported overrides. Track upstream stable loader replacement before expanding tooling use. Both legacy esbuild-kit packages are deprecated in favor of tsx.

npm also left three esbuild postinstall scripts blocked by its script policy; generation and checking work with installed platform binaries, so no additional scripts were approved. Node's built-in database tests emit a harmless `MODULE_TYPELESS_PACKAGE_JSON` warning when importing TypeScript ES modules in the existing mixed-module project; it is not suppressed and does not affect Next.js builds. Keep the module configuration stable rather than changing the entire application to remove a test-only parsing warning. No credentials, external services, Git commits, pushes, or deployments are introduced by Task 4A.

Task 4A resumed audit (2026-10-13): preserve the existing schema and unapplied migration. Strengthen tests by comparing every existing SQL statement against fresh in-memory Drizzle DDL, without writing migration files or connecting to a database. All seven database tests and thirteen local production route regressions passed. Generation reports no changes and history checks pass; existing locked package metadata remains unchanged. Fresh registry checks still select ORM 0.45.4 and Kit 0.31.11. Reconfirmed zero production and nine development audit findings. Revisit the tooling when a stable compatible Drizzle loader/esbuild fix or braces patch appears, before enabling Studio/serve or introducing untrusted pattern inputs, and before database connection/deployment changes. No forced fixes or unrelated changes are authorized by this review.

## Task 4B.4 development connection verification — 2026-10-13

Install exact stable `@neondatabase/serverless` 1.2.0 for HTTPS-based one-shot queries. It requires Node.js 19 or newer, is compatible with the project's Node.js 24 and Drizzle ORM 0.45.4, and does not require WebSocket support for this access pattern. Keep runtime initialization lazy in any future application implementation so builds remain independent of database credentials.

Use the pooled `DATABASE_URL` for future serverless application queries. Reserve direct `DATABASE_URL_UNPOOLED` for separately authorized migration or session-level work. Both local URLs were structurally validated against the expected isolated development endpoint and `neondb`; both returned the same expected result and PostgreSQL version from a fixed `SELECT` executed inside an explicitly read-only transaction. Error reporting was fixed and credential-free.

Credentials remain only in ignored `.env.local`; `.env.example` contains empty placeholders. The Drizzle configuration still contains no credentials, and no migration, DDL, DML, schema introspection, production/Vercel variable change, commit, push, or deployment occurred. A successful connection probe does not mean the initial migration has been applied or that application database access is implemented.

## Task 4B.5 initial development migration — 2026-10-13

Treat the current project-owner-provided Neon dashboard mapping of `ep-sweet-bread-b72xtg4u` as the development branch boundary, and require both local URLs to match it and `neondb` before connecting. Use the direct non-pooler URL exclusively for migration execution. Preflight must be read-only and must stop on existing migration history, planned-name conflicts, an endpoint mismatch, or a failed connection. Managed `neon_auth` objects are outside application ownership.

Use `drizzle-orm/neon-serverless/migrator` with a one-connection Neon Pool so the application DDL and history insertion run transactionally. Verify the exact checked-in SQL checksum before execution. Do not use the nontransactional HTTP migrator for schema changes, `drizzle-kit push`, schema regeneration, pooler fallback, Vercel credentials, startup/build migrations, or any production connection.

The development result matches the checked-in snapshot: 4 tables, 58 columns, 6 enums, 4 primary keys, 5 unique constraints, 3 restrictive foreign keys, 16 checks, and 17 total indexes. The Drizzle history has one matching record. Thirteen integration scenarios passed inside a rolled-back transaction, and a separate query confirmed zero residue. A second migrator invocation left the catalog fingerprint and single history row unchanged. Keep production migration, runtime data access, ingestion, commit, push, and deployment outside this task.

## Task 4B.9 production migration preparation — 2026-10-14

Prepare a committed operator-only runner instead of reusing `.env.local`, the development variable names, Drizzle Kit, or deployment configuration. The runner reads only `.env.production-migration.local`, requires mode `0600`, refuses symlinks and extra variables, and accepts only `PRODUCTION_DATABASE_URL_UNPOOLED`. It requires direct TLS access to `neondb` at exact endpoint `ep-spring-grass-b7iye83x`; therefore the development endpoint, pooler, recovery checkpoint, and all unknown endpoints fail closed. The credential never appears in source, command arguments, prompts, or logs.

Lock production execution to the development-tested `0000_initial_intelligence.sql` byte checksum and journal identity. Before any write, require an explicit `--execute` mode, two catalog preflights, a safe `public` search path, the verified empty application baseline, absent Drizzle history, the nine-table managed-auth baseline, an interactive TTY, and the exact endpoint-bearing confirmation phrase. Apply with one acquired direct Neon client through `drizzle-orm/neon-serverless/migrator`; history belongs only in `drizzle.__drizzle_migrations` and application DDL belongs only in `public`.

Treat endpoint-to-branch metadata revalidation and fresh production authorization as execution prerequisites. Task 4B.9 does not connect to production, create the credential file, or apply SQL. If a future run fails after modification begins, stop for catalog/history comparison and recovery review rather than retrying automatically.

## Task 4B.10 initial production migration — 2026-10-14

Apply the development-tested migration only after the production-only runner accepts the direct endpoint, exact database, checksum, empty application baseline, absent history, safe search path, and nine-table managed-auth baseline. Preserve the verified `pre-initial-migration` checkpoint without modification. Use the runner's exact interactive confirmation; do not use `drizzle-kit push` or deployment-time migrations.

The migration and built-in postflight succeeded. An independent read-only catalog pass verified 4 tables, 58 columns, 6 enums, 4 primary keys, 5 unique constraints, 16 checks, 3 restrictive foreign keys, 17 indexes, one matching Drizzle history row, and zero application rows. The runner's before/after authentication catalog fingerprint comparison passed, and the managed authentication table count remained nine. Matching history makes the initial migration a no-op on a normal repeat.

Keep production credentials only in the ignored permission-restricted migration file. Builds, startup, imports, and Vercel deployment remain unable to invoke the production runner automatically. Production schema availability does not authorize runtime queries, ingestion, authentication integration, or application features.

## Task 5 Technology Sources Catalog — 2026-10-14

Use the existing `sources` table for the first intelligence feature without changing the approved schema or migration. Read through Drizzle's Neon HTTP adapter from a server-only query module. Create the client lazily after a real request, apply a bounded cancellation timeout, validate every search parameter, use parameterized expressions, and cap results at 100. Keep the initial response uncached so catalog changes are visible without an invalidation mechanism; reconsider bounded revalidation when authenticated source administration exists. Task 6 raises the shared query timeout from eight to 15 seconds after a real cold-start regression reached the original limit; failures still cancel and render a fixed safe state.

Register 11 first-party technology sources with verified official HTTPS website URLs and no invented feed endpoints. Leave reliability, collection, cursor, and freshness fields unset. Official publisher status records provenance and does not establish that every future item is independently verified.

Keep all catalog writes in explicit operator tooling. Development accepts only the exact direct development endpoint. Production reuses the dedicated `0600` credential file and exact direct main-endpoint allowlist, then requires `--execute` and an endpoint-bearing interactive phrase. The operation is insert-only, stops on identity conflicts, verifies migration history, compares the managed-auth fingerprint, and checks that other application tables do not change. It is absent from install, build, start, and Vercel configuration. No public write route or Server Action is introduced.

## Task 6 Technology news collection — 2026-10-14

Use six static, reviewed first-party feed definitions rather than adding a premature feed-management table or overloading `sources.canonical_url`. AWS Architecture, Google Cloud, Cloudflare, Kubernetes, CNCF, and HashiCorp provide compatible RSS/Atom identities and unique article links. Keep the valid Linux kernel release feed inactive because all entries link to the same homepage; inventing release URLs or weakening canonical-URL uniqueness would corrupt the reviewed identity model.

Adopt exact stable `fast-xml-parser` 5.11.2 as the only new runtime dependency. Disable entity processing and reject DOCTYPE/ENTITY declarations before parsing; combine this with HTTPS host allowlists, manual bounded redirects, content-type validation, 2 MiB/15-second limits, plain-text field normalization, a 700-character summary limit, 20 items per publisher, and concurrency two. Static feed configuration is trusted; provider responses are untrusted. React's normal escaping remains the rendering boundary.

Resolve repeated records by both provider external ID and canonical URL. Stop on split or drifting identities, preserve first collection/original URL, advance last-seen time, and update only mutable publisher metadata. Keep entries `unverified`; do not create `stories` or evidence links from publisher status alone. The first guarded run stored 110 items in each Neon environment, and the repeated development run created no duplicates.

Keep ingestion operator-only. Development and production use their exact direct endpoint guards; production reuses the dedicated ignored `0600` file and requires an endpoint-bearing TTY confirmation. There is no API route, Server Action, build/start hook, Vercel Cron, or scheduler. `/stories` reads through a lazy server-only query, is intentionally uncached, validates category/source filters, caps output at 100, and shows safe error/empty states. Review caching when scheduling and invalidation exist; add durable retries, run history, freshness, and story verification in later authorized work.

Fresh audit results remain zero for production dependencies and nine for development tooling: the existing `braces` lint chain and legacy Drizzle Kit/esbuild chain. Do not apply npm's forced incompatible downgrades. Built-in Node tests continue to emit the documented module-type warning for direct TypeScript imports; `allowImportingTsExtensions` is enabled because operator scripts share the strictly typed parser under Node's native type stripping without changing emitted application code.

## Task 7 automated collection — 2026-10-14

Use one Vercel Cron definition at `0 6 * * *` UTC. This satisfies the Hobby once-daily limit; Hobby timing is hourly rather than minute-precise. The Node.js Function uses the current 300-second Hobby Fluid Compute allowance with a 225-second internal abort budget. Keep the six approved feeds, concurrency two, per-request 15-second timeout, and add one 750 ms retry only for failed publishers. Vercel itself does not retry failed Cron requests.

Protect `GET /api/cron/news` with a randomly generated, production-only Vercel `CRON_SECRET`, exact Bearer authorization, and Vercel production-environment checks. Missing configuration returns 503, invalid authorization returns 401, and non-production deployments return 404 without database work. Keep the secret outside Git, browser bundles, responses, and logs. The route is the sole scheduled write surface; no public Server Action or administrative API exists.

Add `collection_runs` with an additive checksum-locked migration. A partial unique index permits one running job, and a 240-second lease enables recovery after termination. Verify the lease token under a row lock inside the same transaction that persists source items and completes the run. Record succeeded, partially succeeded, failed, skipped, source keys, counts, and fixed failure codes. Display only the latest fully successful completion publicly.

The migration was applied development first and then production using exact direct-endpoint guards, Drizzle history validation, interactive production confirmation, and before/after managed-auth fingerprints. The result is one new table, two enums, five named constraints, four indexes including the primary key, and a second matching Drizzle history row. Existing application row counts and all nine managed `neon_auth` tables were preserved. Builds and deployment do not execute migrations.

The first controlled production route invocation succeeded across all six feeds, inserted one new item, recognized 109 unchanged items, and released its lease. A read-only postflight found 111 source items, zero active runs, zero duplicate identity groups, two matching migration records, and all nine Neon Auth tables. The preceding unauthenticated request returned 401 and created no run. Treat the first scheduled execution as pending until Vercel invokes the next 06:00–06:59 UTC Hobby window.

## Task 8 expanded intelligence coverage — 2026-10-14

Activate Azure Blog, Linux Kernel Archives, Cisco Security Advisories, GitHub Engineering, NIST Cybersecurity Insights, and NVIDIA Technical Blog alongside the six existing feeds. This expands the subject mix without changing schema or adding a second collector. Add only Cisco PSIRT to the source registry because the other publishers were already registered.

Keep the feed count at 12 for this rollout. With concurrency two, a 15-second timeout, and one retry, the theoretical two-pass network window is 180.75 seconds; the catalog caps processing at 210 items. Defer otherwise valid Ubuntu, Red Hat, CISA, GitHub Changelog, GitLab, and Docker feeds until measured run history justifies another bounded expansion. Azure Updates is also deferred because its tested `/updates/feed` candidate resolves to HTML rather than an RSS/Atom document.

For `kdist.xml`, accept only stable/LTS entries containing a version-matched official `cdn.kernel.org/.../ChangeLog-*` URL supplied in the feed. Retain the provider GUID and reject mainline/linux-next entries that lack that link. Do not synthesize release URLs or weaken `(source_id, canonical_url)` uniqueness.

Treat DOCTYPE text inside a CDATA payload as inert article markup while continuing to reject document-level DOCTYPE and ENTITY declarations with XML entity processing disabled. Administrative ingestion now uses the same retry, lease, transactional persistence, and durable run record as Cron, with exact direct-endpoint guards and production confirmation. Validate both applied migration records; builds and ordinary page requests still cannot execute writes.

Development activated all 12 feeds and reached 187 stored items after live feed changes; the stable repeat inserted zero and recognized 182 unchanged current identities. Production registered Cisco and completed one guarded run across all 12 publishers: 74 inserted, 108 unchanged, no failures, and a 12.253-second leased execution. Read-only postflight verified 185 production items, zero duplicate identity groups, zero active leases, two migration records, no stories/evidence links, and all nine managed authentication tables intact.

## Task 9 Jobs & Opportunities Hub — 2026-10-14

Model employers, recruiting sources, and vacancies separately. This preserves employer identity when boards change and prevents provider IDs from being treated as globally unique. Use restrictive foreign keys, generated UUIDs, source-scoped external IDs, unique slugs and listing URLs, and nullable fields whenever a provider does not disclose a fact. Store only reviewed summaries and public metadata; link applications to the official external destination.

Keep job reads request-time and server-only. Validate every URL parameter, cap pages at 12 and page numbers at 100, and exclude unverified records from public results. Provide no public write route, Server Action, employer dashboard, candidate account, CV upload, or internal application flow before authentication and authorization exist.

Use a checksum-locked forward migration and separate idempotent importer. The importer must verify exact provider records live, reject redirects and unknown hosts, compare deterministic catalog hashes, preserve unrelated table counts and the managed-auth fingerprint, and require exact development/production direct endpoints. Production requires an interactive confirmation. No normal build, deployment, route, or Cron process invokes migration or import tooling.

Initial JobPosting structured data remains disabled. Provider APIs do not consistently supply an original publication date, and the platform stores concise reviewed summaries rather than full employer descriptions. Emit markup only when a future record independently passes the completeness gate; never invent dates, qualifications, eligibility, or compensation for search visibility. Canonical metadata and sitemap discovery remain enabled for open detail pages.

The initial production catalog is 11 open vacancies across Canonical, Moniepoint, Supabase, and Veeva. Listing presence was rechecked against official Greenhouse, Ashby, and Lever records immediately before import. This confirms official publication at that time; it does not independently vet the employer or guarantee continued availability. Task 10 should add bounded recurring status verification, and Task 11 should address authenticated marketplace and verified-talent capabilities.

## Task 10 automated vacancy maintenance — 2026-10-15

Use employer-specific public boards, never a fictional cross-employer provider search. The approved registry is Canonical, Moniepoint, Supabase, Veeva Systems, GitLab, Grafana Labs, and Tailscale. Greenhouse and Ashby return complete published boards. Veeva's full Lever response measured about 13.4 MiB, so use Lever's documented `department=Engineering` filter and exact public-posting verification for the previously tracked Veeva listing. This keeps the operation bounded while documenting that Veeva discovery is scoped rather than all-department.

Require a technical role term in the vacancy title and an approved cloud, platform, SRE, DevOps, Linux, networking, infrastructure, Kubernetes, security, systems, database, observability, or deployment domain in the title/description. This deterministic rule intentionally favors explainable inclusion over AI classification. Review false positives/negatives from run history before broadening it.

Never interpret a failed provider call as closure. Only successful approved board scopes may advance missing evidence. First absence changes an open record to verification pending; second consecutive absence closes it. A known elapsed employer deadline may expire it immediately. Reappearance resets the evidence and reopens the record. Retain closed pages but remove the application action and exclude them from default open search.

Use a separate `job_discovery_runs` table with the news collector's proven database lease pattern. Concurrency three, 30-second source deadlines, a 6 MiB ceiling, 600-record ceiling, one 750 ms retry, and a 225-second route budget bound the seven-source run. Source failure is isolated and produces `partially_succeeded`; an all-source failure is failed. Store only fixed failure categories publicly inaccessible through PostgreSQL, never response bodies or secrets.

Schedule one additional Hobby-compatible daily Cron at `0 8 * * *` UTC, separated from news collection at `0 6 * * *`. Vercel Hobby can invoke it anywhere within the configured hour. Reuse the existing production `CRON_SECRET` and the shared fail-closed authorization boundary; no new secret or public administrative surface is needed. The first manual production run is deployment verification, not evidence that the first scheduled invocation occurred.

Production rollout completed through exact-endpoint migration and discovery guards. It created the fourth history record, inserted 472 new relevant jobs, refreshed 11 existing jobs, and retained zero duplicate identities. News data and all nine managed Auth tables were unchanged. The first Vercel-scheduled 08:00 UTC execution remains pending until observed.

## Task 11 device-local Educational Content Studio — 2026-10-15

Keep unpublished content out of server persistence until an application-level owner session and authorization policy exist. Provider-managed Neon Auth tables are not treated as working application authentication. Use a versioned, validated, 1 MB browser-local document for the first release, bounded to 100 ideas, 100 drafts, 12 evidence references per document, and 20 revision checkpoints per draft. The interface must disclose that this is device-specific storage rather than synchronized backup.

Preserve all 20 original formats in one typed catalog. Historical Evolution & First Principles and Real-World Analogies have separate identifiers, guidance, and templates. Permit only a bounded read-only `source_items` query for optional evidence; publisher attribution remains supporting context and is never relabelled as independent verification.

Generate visual previews and PNG downloads deterministically in the browser with SVG and Canvas. Store only the compact specification with the draft. Do not store image base64 in PostgreSQL, use Vercel's temporary filesystem for persistence, or provision asset storage before a durable provider is chosen.

Define a provider-independent future image interface while leaving OpenAI Images and xAI Grok Imagine disabled. No SDK, provider key, storage service, or billable API call is required. Keep X publishing, scheduling, analytics, and Grok calls disconnected. Ready-for-review is a local editorial state, and the 280-character counter is a conservative preflight that a future publisher must revalidate.

No database migration is necessary for this security model. Revisit durable content persistence only after authenticated ownership, authorization, revision retention, and asset-storage requirements are approved.
