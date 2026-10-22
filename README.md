# AI Whiteboard

A whiteboard built on Excalidraw where AI works **on the canvas**, not in a chat
box beside it. The canvas is just JSON; every AI feature follows the same loop:

```
canvas JSON -> { nodes, edges } graph -> LLM -> validated result -> apply to canvas
```

See [`docs/00-PROJECT-CONTEXT.md`](docs/00-PROJECT-CONTEXT.md) for the full plan.

## Layout

```
apps/
  web/   React + Vite (the whiteboard UI)
  api/   Node + Express (talks to the LLM provider; owns the API key)
packages/
  shared-types/  zod schemas and shared contracts (@wb/shared-types)
  scene-graph/   Excalidraw elements <-> Graph / Ops (@wb/scene-graph)
  ai-core/       prompts, LLM wrapper, mode router (@wb/ai-core)
  layout/        graph placement + tidy (@wb/layout)
```

Internal packages are consumed as TypeScript source (their `exports` point at
`src/index.ts`), so no build step is needed during development.

## Requirements

- Node.js >= 22
- pnpm 11 (`corepack enable` or `npm i -g pnpm`)

## Getting started

```sh
pnpm install
pnpm dev
```

- Web (Vite): http://localhost:3000
- API (Express): http://localhost:3001

## Scripts

| Command          | What it does                       |
| ---------------- | ---------------------------------- |
| `pnpm dev`       | Start web and api in watch mode    |
| `pnpm build`     | Production build of all workspaces |
| `pnpm typecheck` | Type-check every workspace         |
| `pnpm lint`      | Lint every workspace               |
| `pnpm test`      | Run the vitest suites              |
| `pnpm format`    | Format with Prettier               |
| `pnpm docker:build` | Build the production web/api images |
| `pnpm docker:up`    | Start the Docker Compose stack      |
| `pnpm docker:down`  | Stop the Docker Compose stack       |
| `pnpm docker:logs`  | Follow Docker Compose logs          |

## Deployment

The app ships with production Dockerfiles, a Compose stack, and a GitHub
Actions pipeline that tests, builds, publishes images to GHCR, and optionally
deploys over SSH. See [`docs/deployment.md`](docs/deployment.md).

## Environment

Copy `.env.example` to `.env` and fill in values as features land. Never commit
`.env` files or secrets — the LLM API key lives on the server only.
