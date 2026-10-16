# Cloud Engineering Agent

Cloud Engineering Intelligence and X Content Platform. The deployed application includes a responsive workspace, a 12-feed scheduled technology-news collector, a trusted Sources catalog, a public Jobs & Opportunities Hub backed by Neon PostgreSQL, and a device-local Educational Content Studio with deterministic PNG visuals. The jobs hub discovers and verifies relevant vacancies daily across seven official employer boards and always sends applications to the employer or authorized recruiting platform.

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

`npm run start` serves an existing production build locally; it does not deploy the application. No additional test-framework dependency is installed. Node's built-in test runner covers database migrations, ingestion, scheduling, job validation, content documents, and route behavior. With the development server running on port 3100, use `npm run test:shell`, `npm run test:jobs:http`, `npm run test:sources:http`, `npm run test:news:http`, and `npm run test:content:http` for HTTP regression checks.

Development and production builds use Next.js's supported Webpack mode with Tailwind's official PostCSS integration. This avoids the Turbopack production CSS worker port-binding failure in this execution environment. See `docs/DECISIONS.md` for the recorded reason and known upstream tooling warnings.

## Project structure

- `src/app/`: App Router layout, dashboard, news, sources, jobs explorer/detail routes, educational-content routes, sitemap, remaining placeholders, and Tailwind CSS.
- `src/components/`: shared shell, navigation, appearance control, jobs, content workspaces, visual rendering, and page presentation components.
- `src/lib/workspace.ts`: typed navigation and descriptive page catalog.
- `docs/MASTER-BLUEPRINT.md`: all product requirements, independent teaching styles, private hub, and future technology direction.
- `docs/PROJECT-ROADMAP.md`: current foundation scope and planned later work.
- `docs/ARCHITECTURE.md`: current structure and planned responsibility boundaries.
- `docs/DECISIONS.md`: recorded decisions and their implementation status.
- `AGENTS.md`: permanent engineering standards and coding-agent instructions.
- Root configuration: Next.js, ESLint, strict TypeScript, runtime version, npm manifest/lockfile, and Git exclusions.

The `@/*` alias maps to `src/*`. The application uses the [official Next.js generator](https://nextjs.org/docs/app/api-reference/cli/create-next-app) and its empty App Router/Tailwind template.

## Scope and secrets

Owner authentication, persistent private content, AI-assisted ideas and drafts, and an owner-initiated visual-content workflow are implemented. Generated and uploaded images use private durable storage and owner-scoped PostgreSQL metadata; no AI request is scheduled or publicly callable. Employer/candidate accounts, X publishing, and notifications remain future work. See [docs/CONTENT-STUDIO.md](docs/CONTENT-STUDIO.md). Local and dedicated production migration credentials are used only by authorized server-side tooling and remain outside source control. Public routes expose no administrative writes. Keep this project separate from the Football X Agent.

Environment files, private keys, local credentials, build output, and dependencies are excluded from Git. No secrets or environment files are required for Task 1. Keep future secrets server-side and never place them in `NEXT_PUBLIC_*` variables.

## Offline database tooling

`npm run db:generate -- --name=<change-name>` generates reviewed SQL; `npm run db:check` checks migration history; `npm run test:db` runs offline database checks. These commands do not need a connection URL even though the Neon serverless driver is installed for authorized connectivity and migration work. See [docs/DATABASE.md](docs/DATABASE.md) before database changes. `.env.example` contains empty pooled and direct placeholders; real values belong only in ignored local environment files. Generation is not migration application, and no automatic or production schema synchronization is configured.
