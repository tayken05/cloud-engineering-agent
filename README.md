# Cloud Engineering Agent

Cloud Engineering Intelligence and X Content Platform. Task 2 adds a responsive application shell, an introductory dashboard, twelve navigation routes, and descriptive feature placeholders. Task 4A adds an offline PostgreSQL/Drizzle schema and initial migration; no product integrations or live data workflows are implemented.

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

`npm run start` serves an existing production build locally; it does not deploy the application. Meaningful behavior tests will be added when product behavior is introduced. No additional test-framework dependency is installed. With the development server running on port 3100, run `npm run test:shell` to check all routes and unknown-route behavior using Node's built-in test runner. Set `SHELL_TEST_URL` for another local port. Responsive navigation and appearance are also checked with browser automation.

Development and production builds use Next.js's supported Webpack mode with Tailwind's official PostCSS integration. This avoids the Turbopack production CSS worker port-binding failure in this execution environment. See `docs/DECISIONS.md` for the recorded reason and known upstream tooling warnings.

## Project structure

- `src/app/`: App Router layout, dashboard, eleven feature placeholders, and Tailwind CSS.
- `src/components/`: shared shell, navigation, appearance control, and page presentation components.
- `src/lib/workspace.ts`: typed navigation and descriptive page catalog.
- `docs/MASTER-BLUEPRINT.md`: all product requirements, independent teaching styles, private hub, and future technology direction.
- `docs/PROJECT-ROADMAP.md`: current foundation scope and planned later work.
- `docs/ARCHITECTURE.md`: current structure and planned responsibility boundaries.
- `docs/DECISIONS.md`: recorded decisions and their implementation status.
- `AGENTS.md`: permanent engineering standards and coding-agent instructions.
- Root configuration: Next.js, ESLint, strict TypeScript, runtime version, npm manifest/lockfile, and Git exclusions.

The `@/*` alias maps to `src/*`. The application uses the [official Next.js generator](https://nextjs.org/docs/app/api-reference/cli/create-next-app) and its empty App Router/Tailwind template.

## Scope and secrets

Live database connections, authentication, live dashboard data, AI, X API, scheduled processing, notifications, and deployment are future work. Do not install or configure these based on roadmap entries alone. Keep this project separate from the Football X Agent.

Environment files, private keys, local credentials, build output, and dependencies are excluded from Git. No secrets or environment files are required for Task 1. Keep future secrets server-side and never place them in `NEXT_PUBLIC_*` variables.

## Offline database tooling

`npm run db:generate -- --name=<change-name>` generates reviewed SQL; `npm run db:check` checks migration history; `npm run test:db` runs offline database checks. No connection URL or database driver is required. See [docs/DATABASE.md](docs/DATABASE.md) before future database changes. `.env.example` contains only an empty planned `DATABASE_URL`; preserve existing ignored local environment files. Generation is not migration application, and no production schema synchronization is configured.
