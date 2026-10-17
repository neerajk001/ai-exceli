# v1.0: Production hardening and deploy

**Read `00-PROJECT-CONTEXT.md` first.** Requires v0.11. This version adds no features. It makes everything safe, observable, tested, and deployed.

## Goal
Real users can use the app without it breaking, leaking data, or running up an unbounded LLM bill.

## 1. Security
- [ ] `helmet` on the API; CORS restricted to the exact production web origin.
- [ ] Environment validation (zod) covers every production variable; the server refuses to start if any is missing.
- [ ] **Per-user** rate limiting on `/ai` (replacing the IP-based placeholder), plus a **daily usage budget** per user: add a `UsageLog` table (`userId`, `mode`, `inputTokens`, `outputTokens`, `createdAt`) via a Prisma migration. Return a clear 429 with the reset time when the budget is used up.
- [ ] Prompt-injection safety review: diagram text is treated as data in every prompt; AI ops are validated, ids must exist, op count is capped; `answer` and generated code are rendered as text and never executed or injected as HTML.
- [ ] Confirm no secrets in the web bundle (search `dist/` for the LLM key, database URL, and any service-role key; report the result).
- [ ] Request size limits on every route; scene and image payloads are bounded.
- [ ] Dependency audit (`pnpm audit`) with high/critical issues resolved or documented.

## 2. Reliability
- [ ] LLM call timeout (about 30s) and one retry with backoff for transient errors; a clean user-facing error otherwise.
- [ ] `GET /health` also checks database connectivity (`SELECT 1`) and returns 503 if it fails.
- [ ] Graceful shutdown (close HTTP server and Prisma on SIGTERM).
- [ ] Web: error boundary around the canvas; toasts for network and AI errors; every async button has loading and disabled states; autosave failure is visible.

## 3. Observability
- [ ] Structured logging with `pino` and a request id on every log line. Log token usage per AI call. **Do not log board contents or prompts** (user privacy).
- [ ] Error tracking on web and API (Sentry has a free tier; optional but recommended). Strip board contents from reports.

## 4. Testing and CI
- [ ] Unit tests across packages, plus API integration tests (auth, ownership, rate limit, budget).
- [ ] An `MOCK_LLM=1` mode so the whole app runs without a real provider.
- [ ] One end-to-end smoke test (Playwright) using `MOCK_LLM`: sign in, draw, ask the canvas, see the answer and highlight.
- [ ] GitHub Actions workflow: install, typecheck, lint, test, build on every push and pull request.

## 5. Deploy
- [ ] A separate Supabase project for production (never share dev and prod data). Run migrations with `prisma migrate deploy` as a release step.
- [ ] Deploy `apps/web` to a static host with a free tier (for example Vercel or Netlify) and `apps/api` to a Node host with a free tier (for example Render, Railway, or Fly.io). **Check each provider's current free-tier limits and cold-start behavior** and report them.
- [ ] Set Supabase Auth redirect URLs and the API's `WEB_ORIGIN` to the production domain.
- [ ] A documented environment-variable table (name, where it's used, secret or not) in `README.md`.
- [ ] `docs/DEPLOY.md`: step-by-step deploy and rollback instructions.

## 6. Product polish and basics
- [ ] Empty states (no boards, empty canvas), a sample board with an example diagram, and a keyboard shortcut to toggle the AI panel.
- [ ] A short, honest privacy note in the app: diagram contents are sent to an LLM provider when AI features are used.
- [ ] Basic privacy policy and terms pages (plain language).

## Acceptance criteria (report evidence for each)
- CI is green on the default branch.
- The production site works end to end: sign up, draw, all four AI modes, save and reload a board.
- A user over their daily budget gets a clear 429, and the budget resets as documented.
- User B cannot access user A's boards in production (verified by test, not assumed).
- No secrets found in the web bundle. `/health` reports DB status.
- Killing the LLM provider connection produces a friendly error, not a crash.

## Do NOT
- Add new features, new AI modes, or real-time collaboration.
- Share a database between dev and production.
- Log user diagrams or prompts.

## Commit message and tag
`chore: production hardening and deploy (v1.0)` · then `git tag v1.0.0`

## Backlog after v1.0 (not part of this version)
Real-time multi-user sync (`apps/collab` with Yjs), wireframe-to-React, voice-to-canvas, auto-generated walkthrough presentations, board sharing.
