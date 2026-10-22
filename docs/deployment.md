# Deployment

The production stack has two containers:

```
browser -> web (nginx, port 80) -> /api/* -> api (Express, port 3001) -> Postgres/Supabase
```

- `web` serves the Vite production build and proxies `/api/*` to the API.
- `api` runs Prisma migrations on startup, then starts the Express server.
- Images are built by the GitHub Actions workflow and published to GHCR.
- Secrets are supplied at runtime through a `.env` file on the server. They are
  never copied into the images.

## Files

| File | Purpose |
| --- | --- |
| `apps/web/Dockerfile` | Builds the web app and serves it with nginx |
| `apps/web/nginx.conf` | SPA fallback, static caching, `/api` proxy |
| `apps/api/Dockerfile` | API image; runs `prisma migrate deploy` before start |
| `docker-compose.yml` | Production/local web + API stack |
| `.github/workflows/ci-cd.yml` | Tests, Docker build check, GHCR publish, SSH deploy |

## Local Docker

Create a production-style environment file:

```sh
cp .env.example .env
```

Set at least:

```dotenv
WEB_ORIGIN=http://localhost:3000
DOCKER_VITE_API_URL=/api
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
DATABASE_URL=...
DIRECT_URL=...
LLM_PROVIDER=openai
LLM_API_KEY=...
LLM_MODEL=gpt-5.6-sol
```

Leave `DEV_AUTH_TOKEN` and `VITE_DEV_AUTH_TOKEN` empty. Compose sets
`NODE_ENV=production`, and the API refuses to start in production with a dev
auth token.

Then:

```sh
pnpm docker:build
pnpm docker:up
# or: docker compose up -d --build
```

Open http://localhost:3000. Health checks:

```sh
curl http://localhost:3000/healthz
docker compose exec api node -e "fetch('http://127.0.0.1:3001/health').then(r=>console.log(r.status))"
```

`VITE_API_URL` in `.env` is for local Vite development. Docker builds use
`DOCKER_VITE_API_URL` instead; it defaults to `/api` so the nginx proxy is used.

## Environment variables

| Variable | Used by | Notes |
| --- | --- | --- |
| `WEB_ORIGIN` | API | Public web origin used for CORS |
| `WEB_PORT` | Compose | Host port for web, default `3000` |
| `DOCKER_VITE_API_URL` | Compose build | `/api` by default; set a full URL only for a separate API origin |
| `VITE_SUPABASE_URL` | Web build | Public Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Web build | Public anon key |
| `SUPABASE_URL` | API | Server-side Supabase URL |
| `SUPABASE_ANON_KEY` | API | Server-side anon key |
| `DATABASE_URL` | API | Pooled Postgres connection string |
| `DIRECT_URL` | API migration | Direct Postgres URL; falls back to `DATABASE_URL` |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL` | API | Server-only LLM configuration |
| `PORT` | API | Internal port, forced to `3001` by Compose |
| `API_IMAGE`, `WEB_IMAGE` | Compose | Image tags to pull for deployments |

`DEV_AUTH_TOKEN` must be empty in production.

## GitHub Actions setup

The workflow runs on:

- pull requests: typecheck, lint, test, build, Docker build check;
- pushes to `main` and version tags: the same checks, then images are pushed to
  GHCR;
- pushes to `main`: after publishing, it can deploy over SSH.

### Repository variables (Settings -> Variables -> Actions)

| Variable | Required | Value |
| --- | --- | --- |
| `DEPLOY_ENABLED` | For deploy | `true` to enable automatic SSH deployment |
| `VITE_SUPABASE_URL` | For web image | Public Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | For web image | Public anon key |
| `VITE_API_URL` | Optional | Defaults to `/api`; use a full URL only for a separate API origin |
| `DEPLOY_PORT` | Optional | SSH port, default `22` |
| `DOCKER_PLATFORMS` | Optional | Default `linux/amd64`; use `linux/amd64,linux/arm64` for multi-arch |

### Repository secrets (Settings -> Secrets -> Actions)

| Secret | Required | Value |
| --- | --- | --- |
| `DEPLOY_HOST` | For deploy | Server hostname/IP |
| `DEPLOY_USER` | For deploy | SSH user |
| `DEPLOY_SSH_KEY` | For deploy | Private SSH key for that user |
| `DEPLOY_PATH` | For deploy | Absolute path to the repo on the server, e.g. `/opt/tidytboard` |
| `GHCR_TOKEN` | Optional | PAT with `read:packages` if GHCR packages are private; otherwise `GITHUB_TOKEN` is used |

The deploy job assumes the server has a clone of this repository at
`DEPLOY_PATH`, with the remote set and a completed `.env` file. It performs:

```sh
git fetch origin main
git reset --hard origin/main
docker login ghcr.io
docker compose pull api web
docker compose up -d --no-build --remove-orphans
docker image prune -f
```

The untracked `.env` file is preserved by `git reset --hard`.

## Server setup

1. Install Docker Engine and the Compose plugin.
2. Clone the repository into `DEPLOY_PATH`.
3. Create `DEPLOY_PATH/.env` from `.env.example` and fill in the production
   values. Do not set a dev auth token.
4. Point a reverse proxy / load balancer at the web container, or set
   `WEB_PORT=80`.
5. Configure `WEB_ORIGIN` to the public URL, including scheme.
6. Make sure `DEPLOY_USER` can run Docker and has write access to
   `DEPLOY_PATH`.

The API runs `prisma migrate deploy` automatically on container start. Run a
single API replica during migrations, or move migrations to a separate release
job if you scale the API horizontally.

## Image names

The workflow publishes:

```
ghcr.io/<owner>/<repo>/api:<tag>
ghcr.io/<owner>/<repo>/web:<tag>
```

Tags include `latest` on the default branch, the branch name, the git tag, and
an immutable `sha-<full-commit-sha>` tag used by automatic deployments.

## Manual deployment

If you deploy without GitHub Actions, set the image tags in `.env` and run:

```sh
docker login ghcr.io
API_IMAGE=ghcr.io/<owner>/<repo>/api:sha-<sha> \
WEB_IMAGE=ghcr.io/<owner>/<repo>/web:sha-<sha> \
docker compose pull api web
docker compose up -d --no-build
```

Check logs with `pnpm docker:logs` or `docker compose logs -f api web`.
