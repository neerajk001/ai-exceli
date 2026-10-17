# v0.1: Monorepo shell

**Read `00-PROJECT-CONTEXT.md` first.**

## Goal
An empty but working monorepo: web and api both start, and packages import each other.

## Tasks
- [ ] Init git repo and pnpm workspace (`pnpm-workspace.yaml` with `apps/*` and `packages/*`).
- [ ] Root `package.json` with scripts: `dev`, `build`, `typecheck`, `lint`, `test` (all via `turbo run ...`).
- [ ] `turbo.json` with pipelines for those scripts (`dev` is persistent, `build` depends on `^build`).
- [ ] `tsconfig.base.json` with `strict: true`; every package extends it.
- [ ] ESLint + Prettier config at the root.
- [ ] Create four packages, each with its own `package.json`, `tsconfig.json`, and `src/index.ts` exporting one placeholder:
  - `@wb/shared-types` (can depend on `zod`)
  - `@wb/scene-graph`
  - `@wb/ai-core`
  - `@wb/layout`
- [ ] Internal packages are consumed as TypeScript source (`"main"`/`"exports"` pointing at `src/index.ts`) so no build step is needed during dev. Use whatever approach works cleanly with Vite and `tsx`.
- [ ] `apps/web`: Vite + React + TypeScript template. Show a value imported from `@wb/shared-types` on the page.
- [ ] `apps/api`: Express + TypeScript run with `tsx watch`. Add `GET /health` returning `{ "ok": true }`. Split into `src/app.ts` (exports `createApp()`) and `src/server.ts` (calls listen) so tests can import the app.
- [ ] `.gitignore`, root `README.md` (how to install and run), `.env.example` (empty for now).

## Acceptance criteria
- `pnpm install` succeeds from a clean clone.
- `pnpm dev` starts web (Vite) and api (port 3001).
- `curl localhost:3001/health` returns `{"ok":true}`.
- The web page renders a value coming from `@wb/shared-types`.
- `pnpm typecheck`, `pnpm lint`, and `pnpm build` all pass.

## Do NOT
- Install Excalidraw, Prisma, Supabase, or any LLM SDK yet.
- Add features beyond the placeholders.

## Commit message
`chore: monorepo shell (v0.1)`
