# Permanent Engineering Standards and Codex Operating Instructions

These instructions apply throughout this repository. Develop one explicitly assigned task at a time. VS Code is the development environment, Codex is the coding agent, and ChatGPT is the technical architect. This project is the Cloud Engineering Intelligence and X Content Platform, separate from the Football X Agent.

## Required development rules

1. Before making changes, inspect the working tree and read only the task-relevant documentation sections. Use `docs/MASTER-BLUEPRINT.md` for product intent, `docs/CREATIVE-INTELLIGENCE-CHARTER.md` for creative and editorial behavior, `docs/DECISIONS.md` for established choices, and `docs/PROJECT-ROADMAP.md` for implementation status and sequencing; consult architecture and domain documents when the task touches them.
2. Implement only the currently authorized task. Planned features and roadmap entries are not authorization to build them.
3. Use clean, maintainable TypeScript.
4. Avoid `any` unless clearly justified; record the reason when it is necessary.
5. Keep UI, business logic, database access, and external integrations separated.
6. Respect Next.js Server and Client Component boundaries. Prefer Server Components; introduce Client Components only where browser interaction requires them.
7. Handle asynchronous operations correctly with `async/await`, error handling, timeouts, and cancellation where appropriate.
8. Never use unhandled promises for critical operations.
9. Design future background jobs with retries, idempotency, and controlled concurrency.
10. Validate untrusted inputs, including external-provider responses used by the application.
11. Keep secrets server-side and outside source control. Never expose them through browser code, props, logs, or `NEXT_PUBLIC_*` variables.
12. Follow current official documentation. Consult installed Next.js documentation when available and current official sources for framework and provider behavior.
13. Use stable dependencies compatible with the project runtime. Do not introduce canary, preview, beta, or experimental dependencies.
14. Add automated tests for meaningful behavior. Use checks appropriate to the change; avoid tests that merely duplicate implementation.
15. Run lint, type checking, and production build after changes: `npm run lint`, `npm run typecheck`, and `npm run build`.
16. Never suppress errors just to pass tests or checks. Diagnose and fix the underlying issue; report anything unresolved.
17. Avoid unnecessary dependencies and abstractions. Create modules and integrations only when authorized behavior needs them.
18. Never deploy, push commits, or modify external services without explicit approval.
19. Stop after completing the assigned task and provide a verification report. Do not start the next roadmap item without a new assignment.

## Operating conventions

- Use Node.js 24 LTS. Run `nvm use` from the repository before npm commands; `.nvmrc` records the project's tested version.
- Use npm exclusively. Keep `package-lock.json` committed and synchronized with `package.json`; use `npm ci` for reproducible installs.
- Preserve strict TypeScript and the `@/*` → `src/*` import alias.
- Update relevant documentation when authorized work changes scope or architecture. Distinguish implemented features from future plans.
- For creative and editorial work, follow the Creative Intelligence Charter: preserve creative freedom and anti-repetition, prefer intuitive owner workflows, and treat examples as illustrations rather than fixed templates.
- Preserve Style A (Historical-Evolutionary and First-Principles Teaching) and Style B (Real-World Analogy Explainers) as independent content categories.
- Preserve the private Personal Tech Intelligence Hub and its wider-industry scope. Do not expose private data before appropriate server-side access control is implemented.
- Preserve human-reviewed manual X publishing. AI-generated drafts and reply suggestions do not authorize public posting.
- Keep this application's data, content memory, credentials, and external services separate from the Football X Agent.
- Do not overwrite unrelated projects or existing user work. Inspect the working tree before editing and before creating commits.
- For Task 1, do not implement dashboards, authentication, databases, AI integrations, jobs, notifications, or deployment.
- Report changed files, exact relevant package versions, verification results, errors/warnings, and remaining issues. State whether local servers were stopped.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
