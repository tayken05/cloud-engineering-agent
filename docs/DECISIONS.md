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
