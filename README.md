# Cloud Engineering Agent

Cloud Engineering Intelligence and X Content Platform. Task 1 initializes the application foundation and documentation only. The current page is an empty Next.js starter; no dashboard or product integration is implemented.

## Local development

Use VS Code, Node.js 24 LTS, and npm. Codex implements the currently authorized task; ChatGPT provides technical architecture and subsequent assignments.

```sh
cd /Users/macbook/Documents/cloud-engineering-agent
nvm use
npm ci
npm run dev
```

Open `http://localhost:3000`. Stop the server with Ctrl+C. Existing terminals without nvm can load it with `source ~/.zshrc`. `.nvmrc` records the verified Node.js version; `package-lock.json` records exact dependencies.

## Verification

```sh
npm run lint
npm run typecheck
npm run build
```

`npm run start` serves an existing production build locally; it does not deploy the application. Meaningful behavior tests will be added when product behavior is introduced. No test-framework dependency is installed for the empty scaffold.

Development and production builds use Next.js's supported Webpack mode with Tailwind's official PostCSS integration. This avoids the Turbopack production CSS worker port-binding failure in this execution environment. See `docs/DECISIONS.md` for the recorded reason and known upstream tooling warnings.

## Project structure

- `src/app/`: App Router layout, empty starter page, and Tailwind CSS.
- `docs/MASTER-BLUEPRINT.md`: all product requirements, independent teaching styles, private hub, and future technology direction.
- `docs/PROJECT-ROADMAP.md`: current foundation scope and planned later work.
- `docs/ARCHITECTURE.md`: current structure and planned responsibility boundaries.
- `docs/DECISIONS.md`: recorded decisions and their implementation status.
- `AGENTS.md`: permanent engineering standards and coding-agent instructions.
- Root configuration: Next.js, ESLint, strict TypeScript, runtime version, npm manifest/lockfile, and Git exclusions.

The `@/*` alias maps to `src/*`. The application uses the [official Next.js generator](https://nextjs.org/docs/app/api-reference/cli/create-next-app) and its empty App Router/Tailwind template.

## Scope and secrets

Database, authentication, dashboard, AI, X API, scheduled processing, notifications, and deployment are future work. Do not install or configure these based on roadmap entries alone. Keep this project separate from the Football X Agent.

Environment files, private keys, local credentials, build output, and dependencies are excluded from Git. No secrets or environment files are required for Task 1. Keep future secrets server-side and never place them in `NEXT_PUBLIC_*` variables.
