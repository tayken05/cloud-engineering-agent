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
| D010 | Consider Neon PostgreSQL and Drizzle ORM. | Planned; not installed | Future persistent data and typed database access. |
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

## Known upstream tooling warning

npm marks ESLint 9.39.5 as deprecated and no longer supported. It remains the latest compatible stable ESLint 9 release selected by the official generator's configuration. This warning is not suppressed. Re-evaluate ESLint 10 when the React and accessibility lint plugins declare compatible peer dependencies, or when an authorized task adopts another fully verified official configuration. See [ESLint version support](https://eslint.org/version-support/) for the upstream support policy.

## Known upstream development-dependency advisory

The installation audit reports high-severity [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) in `braces` 3.0.3. Its installed path is `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`, within development tooling. The advisory lists no patched version, and a fresh npm registry check on 2026-10-12 confirms that 3.0.3 is still the latest release. Do not suppress the finding, force unrelated dependency upgrades, or remove official framework lint rules to hide it. Recheck upstream fixes before expanding the project or deploying it; this foundation is not a claim of production readiness.

## Dependency policy

The live audit reports five high-severity development-tool findings along this single dependency chain. Its suggested forced remediation downgrades `eslint-config-next` to 14.2.35, which does not preserve the Next.js 16 configuration baseline. The runtime-only audit (`npm audit --omit=dev`) reports zero vulnerabilities. Recheck these findings before future work; the offline install's audit summary is not a live security assessment.

Use compatible stable releases, not canary, beta, preview, or experimental releases. The lockfile records exact installed versions. Keep runtime and type definitions aligned with Node.js 24. Read current official documentation before introducing or changing framework and integration behavior. Review upgrades intentionally rather than installing unrelated dependencies.

## Official references

- [Next.js generator](https://nextjs.org/docs/app/api-reference/cli/create-next-app)
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [TypeScript configuration](https://www.typescriptlang.org/tsconfig/)
- [Node.js releases](https://nodejs.org/en/about/previous-releases)
- [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci)

Consult current provider documentation when future integrations are authorized. Listing a provider here does not install it or approve external-service changes.
