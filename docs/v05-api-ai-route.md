# v0.5: API with one route (`POST /ai`)

**Read `00-PROJECT-CONTEXT.md` first.** Requires v0.4.

## Goal
`apps/api` exposes `POST /ai` and calls `ai-core`. No login and no database yet. The LLM key lives only here.

## Tasks
- [ ] `src/env.ts`: validate environment with zod at startup (`PORT`, `WEB_ORIGIN`, `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`). Fail fast with a readable message if something is missing. Update `.env.example`.
- [ ] `src/app.ts` (`createApp(deps)`): accept the `LLMClient` as a dependency so tests can inject a mock.
  - `express.json({ limit: '2mb' })`
  - `cors` allowing only `WEB_ORIGIN`
  - `GET /health`
- [ ] `src/routes/ai.ts`: `POST /ai`
  1. Parse the body with `AIRequest` from `shared-types`. Invalid input returns 400.
  2. Reject graphs over a limit (start with 300 nodes) with 413 and a clear message.
  3. Call `askAI(llm, request)`.
  4. Validate and return `AIResponse`.
- [ ] `src/middleware/errorHandler.ts`: one error shape everywhere: `{ "error": { "code": "...", "message": "..." } }`. Never leak stack traces or provider error bodies to the client; log them server-side.
- [ ] Basic abuse protection: `express-rate-limit` (for example 20 requests/minute per IP). This is a placeholder until per-user limits in v12.
- [ ] Leave a clearly marked spot in the route chain where `requireAuth` will be inserted in v11 (comment only; do not build auth).
- [ ] Tests with `supertest` and a mock `LLMClient`: 200 on valid request, 400 on bad body, 413 on oversized graph, 500 shape on LLM failure.

## Acceptance criteria
- `curl -X POST localhost:3001/ai -H 'content-type: application/json' -d '{"mode":"ask","graph":{...},"input":"..."}'` returns a valid `AIResponse` using a real key.
- Bad body returns 400 with the error shape. Missing env var stops startup with a clear message.
- `pnpm --filter api test` and `pnpm typecheck` pass.

## Do NOT
- Add auth, Prisma, or Supabase.
- Send the API key, provider errors, or stack traces in any response.

## Commit message
`feat(api): POST /ai route with validation and error handling (v0.5)`
