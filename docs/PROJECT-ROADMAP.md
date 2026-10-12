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

## Planned phase: Persistence and verified intelligence

Evaluate Neon PostgreSQL and Drizzle ORM. Design trusted sources, evidence, original links, publication/retrieval/verification timestamps, verification status, duplicate detection, and corrections. Plan durable ingestion with retries, idempotency, timeouts, and controlled concurrency. Do not provision services until authorized.

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
