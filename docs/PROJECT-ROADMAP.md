# Project Roadmap

This roadmap records future scope, not authorization to implement it. Work proceeds one assigned task at a time, with build, test, verification, and review before the next task. Future phases can be revised by the technical architect.

## Task 1: Foundation — completed

- Verify environment and repository boundaries; use Node.js 24 LTS.
- Generate Next.js 16 App Router with React, strict TypeScript, Tailwind CSS, ESLint, npm lockfile, `src/`, and `@/*`.
- Create root `AGENTS.md` and the four required documents.
- Establish reproducible runtime and verification commands, initialize local Git, and exclude secrets.
- Verify ESLint, TypeScript, production build, development server startup, and documentation completeness.
- Stop and wait for review. The foundation originally contained an empty scaffold.

## Task 2: Application shell — implemented

- Reusable desktop sidebar, responsive mobile navigation, current-page header, shared page layout, and descriptive empty states.
- All twelve requested routes, active navigation indicators, semantic landmarks, skip link, and keyboard focus styles.
- Introductory dashboard with links to the four product pillars, honest disconnected status, and independent teaching-style descriptions.
- Browser-local system/light/dark appearance, persistent preferences, and system-theme updates.
- No live data, AI processing, publishing, authentication, integrations, or private information. Feature workflows remain planned.
- Verification passed: lint, strict types, production build, development serving, all twelve routes, thirteen HTTP regression tests, responsive widths from 320px to 1440px, mobile menu interactions, and browser appearance behavior. Stop for review; future phases remain unauthorized.

## Task 3A: Private GitHub repository — completed

The existing history and approved shell are committed on `main` in private repository `tayken05/cloud-engineering-agent`. Source, documentation, and lockfile are tracked; secrets and build artifacts remain ignored.

## Task 3B: Vercel integration and production hosting — completed

Project `cloud-engineering-agent` in personal Hobby scope `tayken05s-projects` uses the private GitHub repository, production branch `main`, Node.js `24.x`, repository-root `npm ci`, and the existing Webpack production build. Main-push deployment was observed; other branches retain the default preview workflow, not separately tested here. Public URL: https://cloud-engineering-agent.vercel.app.

Production verification passed: READY Git-sourced build, all twelve routes returning 200, unknown-route 404, stylesheet/static assets, desktop/mobile navigation, persistent/system themes, and no browser errors. Sensitive file paths returned 404, and the deployment runtime error query returned no logs. Documentation is committed and pushed normally; verify the resulting deployment against latest GitHub main before reporting task completion. No databases, authentication, AI, ingestion, or functional dashboard work is included.

## Planned phase: Private access and product workflows

Specify access control and privacy boundaries for the Personal Tech Intelligence Hub before storing or exposing private information. Authentication and functional dashboard data remain future tasks.

## Task 4A: Offline database foundation — implemented locally

- Stable Drizzle PostgreSQL schemas for sources, collected items, stories, and evidence relationships; real keys, constraints, and targeted indexes.
- Original/canonical attribution, publication/collection/verification times, review metadata, content-hash candidates, and ingestion/retry fields.
- Credential-free Drizzle generation/check configuration, initial SQL migration with snapshot/journal, server-only entry point, lazy environment validation, empty `.env.example`, and offline regression checks.
- Verification passed: offline generation/history/no-change regeneration, seven database tests, lint, strict types, production build, and thirteen local production HTTP checks.
- No Neon provisioning, PostgreSQL driver, live connection, applied migration, information collection, authentication, push, or deployment. Stop for review.

## Task 4B.4: Development connection verification — implemented locally

- Installed the stable `@neondatabase/serverless` HTTP driver as a runtime dependency.
- Validated ignored pooled and direct local connection settings against the expected Neon development endpoint and `neondb` without displaying credentials.
- Confirmed both connection paths with the same `SELECT`-only probe inside read-only transactions.
- Kept the application shell disconnected from the database. No migration, schema introspection, data mutation, Vercel variable change, production connection, commit, push, or deployment occurred.

## Task 4B.5: Initial development migration — completed locally

- Revalidated pooled and direct credentials against the user-designated Neon `development` endpoint and `neondb`; used only the direct non-pooler connection for migration execution.
- Inspected the database before mutation, preserving the managed `neon_auth` schema and confirming that `public` had no conflicting tables, enums, or migration history.
- Applied the existing `0000_initial_intelligence.sql` through Drizzle's transactional Neon serverless migrator without regenerating it or using `drizzle-kit push`.
- Verified 4 tables, 6 enums, 58 columns, all primary/unique/check/foreign-key constraints, 17 indexes, defaults, referential actions, and the single matching Drizzle history record against the checked-in snapshot.
- Passed 13 transaction-scoped integration scenarios and confirmed that rollback left all four tables empty. A second migrator invocation was a catalog/history no-op.
- No production `main` connection, Vercel variable change, authentication-object change, application query path, commit, push, or deployment was introduced.

## Task 4B.9: Production migration procedure — prepared locally, not executed

- Added a production-only direct-connection configuration with the exact verified `main` endpoint, database, migration checksum, journal identity, expected application objects, and managed-auth baseline.
- Added a credential-safe read-only preflight and a separately gated execution path. The latter requires a dedicated ignored `0600` file, explicit `--execute`, repeated catalog checks, and an exact interactive confirmation.
- Added post-migration catalog verification for application tables, enums, keys, checks, foreign keys, indexes, history, empty data, and an unchanged `neon_auth` catalog fingerprint.
- Production endpoint ownership must be reverified and schema modification must be separately approved immediately before execution. No production connection, SQL write, migration, Vercel change, deployment, commit, or push is part of preparation.

## Task 4B.10: Initial production migration — completed

- Passed the production-only read-only preflight against the verified direct `main` endpoint and `neondb`, with an empty application baseline, absent Drizzle history, and nine managed authentication tables.
- Applied only the checksum-locked `0000_initial_intelligence.sql` through the guarded interactive Drizzle runner. The recovery checkpoint, development branch, and managed authentication schema were not modified.
- Verified 4 empty application tables, 58 columns, 6 enums, all expected keys/checks/foreign keys, 17 indexes, and one matching migration-history row. The managed-auth catalog fingerprint remained unchanged, and repeat migration evaluation skips the applied entry.
- Runtime database access, ingestion, application authentication, and data population remain future work. Normal application builds and Vercel deployments do not run migrations.

## Task 5: Technology Sources Catalog — implemented

- Added the first server-only runtime database query using Drizzle and Neon HTTP, with lazy configuration, an eight-second timeout, a 100-row limit, safe errors, and request-time uncached rendering.
- Replaced the Sources placeholder with a responsive catalog, accessible search and topic/type/status filters, official links, enabled state, honest empty/error states, and a clear verification limitation.
- Registered 11 reviewed first-party technology sources in development and production through guarded direct-connection tooling. A repeated development execution inserted zero rows; production postflight found all 11 exact records and zero pending inserts.
- Kept writes out of the public application. No API route, Server Action, schema migration, ingestion job, source reliability score, freshness metric, article, or authentication behavior was added.
- Verification covers catalog identities/category scope, filter validation, wrong-endpoint guards, conflict detection, idempotent planning, development and production pre/postflight, HTTP filters/empty state, safe database-failure rendering, route regressions, lint, strict types, production build, database tests, and dependency audits.

## Planned phase: Expanded verified intelligence

When separately authorized, expand the narrow Sources read path into ingestion behavior. Implement item canonicalization, conflict-safe upserts, transactional cursor advancement, evidence review/corrections, and durable ingestion with retries, idempotency, timeouts, and controlled concurrency. The populated source registry does not collect articles or verify future publisher claims.

## Planned phase: Personal Tech Intelligence Hub

Develop the private hub across all ten subject areas defined in `MASTER-BLUEPRINT.md`. Plan personalized feeds, bookmarks, configurable digests, source freshness, and continuously updated ingestion. Keep private information separate from the public content workflow.

## Planned phase: Research, content, and memory

Build content research and opportunities, then evaluate OpenAI-assisted drafts. Preserve Style A (Historical-Evolutionary and First-Principles Teaching) and Style B (Real-World Analogy Explainers) as independent categories. Support all other defined content types, including Grok interactions. Plan evidence-backed content memory, review, and correction workflows.

## Planned phase: Human-reviewed X workflow

Support manual X publishing after human review and published post tracking. Evaluate the official X API where feasible before choosing integrations. Publication must remain an explicit human action; generating a draft is not permission to publish.

## Planned phase: Engagement and conversation intelligence

Design conversation hubs, a Shared Inbox, and AI reply suggestions. Define access boundaries, source attribution, deduplication, rate limits, and human review requirements before integration work.

## Planned phase: Notifications, jobs, and analytics

Evaluate scheduled and durable background processing, Telegram Bot API, and Browser Push API. Add opt-in browser and Telegram notifications, delivery preferences, analytics, and approved measurement definitions. Design jobs with retries, idempotency, controlled concurrency, cancellation, and observable failures.

## Planned phase: Hosting and communities

Vercel hosts the visual shell as recorded in Task 3B. Future deployment and operational changes still require task authorization. Plan future Telegram and Discord engineering communities separately from the initial platform. Discord integration details are undecided. Preserve separation from the Football X Agent in every phase.

## Completion gate for each authorized task

Read existing documentation, implement only assigned scope, test meaningful behavior, run lint/type checking/production build, verify the relevant user flow, report errors and warnings, and stop for review. Do not interpret this roadmap as permission to install dependencies, deploy, publish, or modify external services.
