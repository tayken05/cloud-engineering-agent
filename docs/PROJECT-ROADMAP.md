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

- Added the first server-only runtime database query using Drizzle and Neon HTTP, with lazy configuration, a bounded timeout, a 100-row limit, safe errors, and request-time uncached rendering. Task 6 set the shared timeout to 15 seconds after a cold-start regression reached the original eight-second limit.
- Replaced the Sources placeholder with a responsive catalog, accessible search and topic/type/status filters, official links, enabled state, honest empty/error states, and a clear verification limitation.
- Registered 11 reviewed first-party technology sources in development and production through guarded direct-connection tooling. A repeated development execution inserted zero rows; production postflight found all 11 exact records and zero pending inserts.
- Kept writes out of the public application. No API route, Server Action, schema migration, ingestion job, source reliability score, freshness metric, article, or authentication behavior was added.
- Verification covers catalog identities/category scope, filter validation, wrong-endpoint guards, conflict detection, idempotent planning, development and production pre/postflight, HTTP filters/empty state, safe database-failure rendering, route regressions, lint, strict types, production build, database tests, and dependency audits.

## Task 6: Technology news collection engine — implemented

- Connected six reviewed first-party RSS/Atom feeds for AWS Architecture, Google Cloud, Cloudflare, Kubernetes, CNCF, and HashiCorp. The Linux kernel release feed remains registered but inactive because its entries do not provide unique article URLs compatible with the current identity constraint.
- Added bounded HTTPS fetching with exact host/redirect allowlists, 15-second cancellation, 2 MiB response limits, 20-item feed batches, concurrency two, XML/entity protections, plain-text normalization, and per-publisher failure isolation.
- Added conflict-safe transactional persistence to `source_items`, preserving source IDs, original links, provider identifiers, publication/collection/last-seen times, and unverified status. Initial development and production runs each stored 110 genuine publisher items; the development repeat inserted zero duplicates.
- Replaced the Stories placeholder with an uncached server-rendered news list, category/publisher filters, newest-first ordering, original links, responsive empty/error states, and explicit publisher-metadata/not-independently-verified language.
- Kept all writes in exact-endpoint guarded operator tooling. Production required the dedicated ignored credential and interactive phrase. No public write endpoint, schema migration, `neon_auth` change, story/evidence creation, Cron job, or automated schedule was added.
- Verification covers RSS/Atom parsing, malformed/entity input, allowlists, size/content-type limits, failure isolation, deduplication/conflict planning, live development repeatability, production postflight, HTTP filters/empty state/secret absence, route regressions, lint, strict types, database checks, Webpack production build, and dependency audits.

## Task 7: Automated technology news collection — implemented

- Added one production Vercel Cron route at `/api/cron/news`, scheduled daily with `0 6 * * *` UTC and protected by a production-only Secret. Preview, local, missing-secret, and invalid-authorization requests fail closed.
- Added `collection_runs` through the reviewed `0001_collection_runs.sql` migration on development and production. It records run state, timing, source outcomes, item counts, safe failure codes, and a 240-second recoverable database lease.
- Reused the six-feed Task 6 pipeline with concurrency two, existing network/content bounds, one bounded retry for failed sources, transactional idempotent writes, and per-source failure isolation.
- Added the latest fully successful collection timestamp to Stories & News without exposing operational errors. Development verified genuine fetching, repeat idempotency, concurrent skip behavior, expired-lease recovery, and partial failure records.
- Production rollout registered the Cron on the intended Git-sourced deployment. The controlled authenticated run processed six publishers, inserted one new item, recognized 109 existing items, released its lease, and left zero duplicate identity groups; an unauthenticated request returned 401 with no run record. The first platform-scheduled invocation remains pending until the next 06:00–06:59 UTC Hobby execution window.

## Task 8: Expanded technology intelligence coverage — implemented

- Added six verified feeds for Azure Blog, Linux Kernel Archives, Cisco Security Advisories, GitHub Engineering, NIST Cybersecurity Insights, and NVIDIA Technical Blog, bringing the scheduled catalog to 12 feeds.
- Added Cisco Security Advisories as the twelfth registered source; all other additions reuse approved catalog records. No schema migration was needed.
- Resolved the Linux homepage-link collision by accepting only official, version-matched stable/LTS changelog URLs embedded in `kdist.xml`; entries without such evidence remain skipped.
- Kept concurrency two, the 15-second fetch timeout, one bounded retry, exact host controls, the single daily Cron, PostgreSQL lease, and durable run records. The catalog ceiling is 210 items and the theoretical two-pass network window is 180.75 seconds within the 225-second route budget.
- Development processed all 12 feeds and 182 live entries. The initial expansion added 75 genuine records; a stable-window repeat added zero and retained zero duplicate identity groups. The guarded production run processed all 12 feeds, inserted 74 new records, recognized 108 unchanged identities, and left production at 185 items with zero duplicates, zero active leases, and nine unchanged Neon Auth tables.

## Task 9: Cloud Careers & Opportunities Hub — implemented

- Added `job_employers`, `job_sources`, and `jobs` with a forward-only Drizzle migration, stable provider identities, nullable factual fields, verification metadata, restrictive relationships, uniqueness checks, and bounded-query indexes.
- Added a responsive `/jobs` explorer with shareable search and employer, specialization, category, country, workplace, experience, employment, salary, and status filters. Results are newest-first and limited to 12 per page.
- Added stable `/jobs/[slug]` pages with canonical metadata, factual source and verification dates, clear vacancy state, and official external application links. The sitemap includes open listings; JobPosting markup remains disabled unless a record meets the documented completeness gate.
- Registered 11 live-verified vacancies from Canonical, Moniepoint, Supabase, and Veeva through guarded, idempotent administrative tooling. Development repeatability inserted zero duplicates; production retained the same reviewed catalog. Existing news data, daily Cron, and all nine Neon Auth tables were preserved.
- Kept employer/candidate accounts, job submissions, applications, CV collection, messaging, payments, recurring discovery, talent verification, contractor matching, and candidate search outside the public unauthenticated application.

## Task 10: Recurring job discovery — implemented

- Added employer-specific Greenhouse, Ashby, and Lever adapters for Canonical, Moniepoint, Supabase, Veeva Systems, GitLab, Grafana Labs, and Tailscale. The deterministic matcher currently maintains 483 relevant public vacancies.
- Added `job_discovery_runs`, source health, vacancy last-seen/last-checked state, recoverable PostgreSQL leases, isolated retries, idempotent synchronization, and two-successful-absence closure confirmation through forward migration `0003_job_discovery.sql`.
- Added a protected production-only `/api/cron/jobs` route at `0 8 * * *` UTC using the existing `CRON_SECRET`; the news Cron remains unchanged at 06:00 UTC. Hobby scheduling may occur anywhere in the configured hour.
- Development verified malformed/failing providers, retry isolation, concurrent skip, expired-lease recovery, stable identities, and a repeat run with 0 inserts, 0 updates, and 483 unchanged records. Production inserted 472 new records, updated the 11 existing records, preserved news and nine Neon Auth tables, and recorded one successful manual run.
- The first actual platform-scheduled job run remains pending until Vercel invokes the next 08:00–08:59 UTC window. Employer/candidate accounts and marketplace workflows remain Task 11.

## Task 11: Verified talent marketplace — planned

Design authentication and authorization before storing private profiles. Future scope may include employer and candidate registration, human-reviewed identity and professional verification, GitHub and project-portfolio evidence, employer verification, contractor/freelance matching, applications, and candidate discovery. Privacy, consent, retention, moderation, and abuse controls must precede implementation.

## Planned phase: Verified story intelligence

When separately authorized, design deterministic story grouping and evidence review/corrections without treating publisher provenance as independent verification. Review source cursor policies and richer private operational observability only when actual run history demonstrates a need. The collector stores bounded publisher metadata only.

## Planned phase: Personal Tech Intelligence Hub

Develop the private hub across all ten subject areas defined in `MASTER-BLUEPRINT.md`. Plan personalized feeds, bookmarks, configurable digests, source freshness, and continuously updated ingestion. Keep private information separate from the public content workflow.

## Planned phase: Research, content, and memory

Build content research and opportunities, then evaluate OpenAI-assisted drafts. Preserve Style A (Historical-Evolutionary and First-Principles Teaching) and Style B (Real-World Analogy Explainers) as independent categories. Support all other defined content types, including Grok interactions. Plan evidence-backed content memory, review, and correction workflows.

## Planned phase: Human-reviewed X workflow

Support manual X publishing after human review and published post tracking. Evaluate the official X API where feasible before choosing integrations. Publication must remain an explicit human action; generating a draft is not permission to publish.

## Planned phase: Engagement and conversation intelligence

Design conversation hubs, a Shared Inbox, and AI reply suggestions. Define access boundaries, source attribution, deduplication, rate limits, and human review requirements before integration work.

## Planned phase: Notifications and analytics

Evaluate scheduled and durable background processing, Telegram Bot API, and Browser Push API. Add opt-in browser and Telegram notifications, delivery preferences, analytics, and approved measurement definitions. Design background work with retries, idempotency, controlled concurrency, cancellation, and observable failures.

## Planned phase: Hosting and communities

Vercel hosts the visual shell as recorded in Task 3B. Future deployment and operational changes still require task authorization. Plan future Telegram and Discord engineering communities separately from the initial platform. Discord integration details are undecided. Preserve separation from the Football X Agent in every phase.

## Completion gate for each authorized task

Read existing documentation, implement only assigned scope, test meaningful behavior, run lint/type checking/production build, verify the relevant user flow, report errors and warnings, and stop for review. Do not interpret this roadmap as permission to install dependencies, deploy, publish, or modify external services.
