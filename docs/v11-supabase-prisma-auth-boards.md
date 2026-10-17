# v0.11: Supabase, Prisma, auth, and saved boards

**Read `00-PROJECT-CONTEXT.md` first.** Requires v0.10.

## Before the agent starts (the human does this)
1. Create a Supabase project (free tier is fine).
2. Collect these values into a local, git-ignored `.env`:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`
   - `DATABASE_URL`: the **pooled** connection string (transaction pooler; append `?pgbouncer=true`). Used at runtime.
   - `DIRECT_URL`: the **direct** connection string. Used by Prisma migrations.
3. In the Supabase dashboard, choose how users sign in (email + password or magic link; Google OAuth optional).

## Goal
Users can sign in, and boards are saved to and loaded from Postgres through Prisma. The AI route now requires login.

## Tasks

### Database (`apps/api/prisma/schema.prisma`)
- [ ] Add Prisma to `apps/api`. Follow the current Prisma + Supabase docs (Prisma's configuration has changed between major versions; use the current approach). Datasource uses `DATABASE_URL` for runtime and `DIRECT_URL` for migrations.
- [ ] Models:
  - `User`: `id` (String, the Supabase auth user uuid, primary key), `email` (unique), `createdAt`. Do **not** add a foreign key to Supabase's `auth.users`; create the row on first authenticated request (upsert).
  - `Board`: `id` (uuid, default generated), `ownerId` (-> `User`), `title`, `scene` (`Json`: the non-deleted elements plus a small `appState` subset such as background color), `createdAt`, `updatedAt`; `@@index([ownerId])`.
- [ ] `src/db.ts`: a single `PrismaClient` instance (avoid creating one per request).
- [ ] Run the first migration. Commit the migration files.
- [ ] **Row Level Security:** enable RLS on both tables with no public policies, so the anon key can't read data through Supabase's REST API. Our API connects via Prisma, which bypasses RLS, so **authorization is enforced in our code** (next section).

### Auth
- [ ] `apps/web/src/auth/`: `@supabase/supabase-js` client, sign-in/sign-up screen, session handling, sign out. Attach `Authorization: Bearer <access_token>` to every API call (extend `api-client`).
- [ ] `apps/api/src/middleware/requireAuth.ts`: verify the bearer token (for example `supabase.auth.getUser(token)` with a server-side Supabase client, or JWT verification per current Supabase docs). Set `req.user = { id, email }` and upsert the `User` row. Return 401 with the standard error shape otherwise.
- [ ] Apply `requireAuth` to `/ai` (insert it at the marked spot from v0.5) and `/boards`. `/health` stays public.

### Boards API (`apps/api/src/routes/boards.ts`)
- [ ] `GET /boards` (own boards, newest first, no scene payload), `POST /boards`, `GET /boards/:id`, `PUT /boards/:id` (title and/or scene), `DELETE /boards/:id`.
- [ ] **Every query filters by `ownerId = req.user.id`.** Accessing someone else's board returns 404 (not 403).
- [ ] Validate bodies with zod; cap scene size (for example 5 MB) and return 413 if exceeded.

### Web
- [ ] Board list page (create, rename, delete, open). Opening a board loads its scene into the canvas.
- [ ] Autosave: debounced (about 2s) `PUT` on canvas change, with a visible "Saving... / Saved" indicator and error retry. Replace the v0.2 localStorage persistence.
- [ ] Routing: `/login`, `/boards`, `/board/:id`. Unauthenticated users are redirected to `/login`.

## Acceptance criteria
- A new user can sign up, create a board, draw, refresh, and see the drawing again (loaded from the database).
- `POST /ai` without a token returns 401; with a token it works as before.
- Two different accounts **cannot** see, update, or delete each other's boards (automated test: user B gets 404 on user A's board).
- RLS is enabled on both tables (report how you verified).
- `.env` is not committed; `.env.example` lists every variable. `pnpm test` and `pnpm typecheck` pass.

## Do NOT
- Put the service-role key or the database URL in the web app.
- Add sharing, teams, or real-time sync.
- Skip the `ownerId` filter "because RLS handles it". It doesn't apply to Prisma connections.

## Commit message
`feat: supabase auth, prisma, saved boards (v0.11)`
