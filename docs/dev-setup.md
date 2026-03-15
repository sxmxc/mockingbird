# Development Setup

## Prerequisites
- Docker Desktop (or equivalent Docker engine)
- Node.js 22+ (for local frontend development; `@vuetify/v0` requires Node 22)
- Python 3.11+ (optional for running backend locally without Docker)

## Quickstart

1. Copy environment defaults:

```sh
cp .env.example .env
```

2. Start all services:

```sh
make up
```

3. Visit the surfaces:
- Public API landing page: http://localhost:8000
- Admin UI: http://localhost:3000
- OpenAPI JSON: http://localhost:8000/openapi.json
- API docs: http://localhost:8000/docs

## Bootstrap notes

- `make up` is safe to run from a bind-mounted checkout even if `start.sh` does not have the executable bit set on the host.
- Local Compose explicitly builds the Dockerfiles' `dev` targets so the API keeps `uvicorn --reload` and the admin app keeps the Vite dev server for fast iteration.
- API startup now runs `alembic upgrade head` before launching Uvicorn, so schema changes and legacy contract migrations are applied automatically.
- The frontend keeps `node_modules` in a Docker volume so the bind-mounted source tree does not hide Vite and other installed dependencies.
- The frontend startup script now hashes `package-lock.json` and refreshes the Dockerized dependency volume automatically when the lockfile changes, which helps keep image/runtime dependencies isolated from host `node_modules`.
- For remote or domain-based frontend access, set `FRONTEND_ALLOWED_HOSTS` in `.env` to a comma-separated list such as `localhost,127.0.0.1,docker01.example.internal`.
- The frontend dev proxy target is configurable through `FRONTEND_DEV_PROXY_TARGET`; Docker should point it at `http://api:8000`.
- Postgres health checks now target the configured application database instead of the default user name.
- `make down` removes the named Docker volumes, which is useful if you want a completely fresh database bootstrap and frontend dependency install.
- Alembic config and revisions live under `apps/api/migrations/` inside the API app because that path is available inside the Docker build context.
- Approved public landing artwork can be dropped into `apps/api/static/landing/` as `hero-top.*` and `hero-bottom.*`; a single tall `hero.*` asset remains supported as a fallback.

## Running tests

```sh
make test
```

Frontend checks:

```sh
docker compose run --rm admin-web npm run lint
docker compose run --rm admin-web npm run test
docker compose run --rm admin-web npm run build
```

## Runtime images

- The production-ready image targets are `runtime`, not the `dev` targets used by local Compose.
- The API runtime image reads `APP_VERSION` so published OpenAPI metadata can match the release tag.
- The admin runtime image serves the built SPA through Nginx and proxies `/api` to `API_UPSTREAM` (default `http://api:8000`).
- The GitHub image workflow validates `runtime` builds on pull requests and publishes multi-arch images on `main` and `v*` tags.

## Local development (backend only)

You can run the backend directly:

```sh
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Local development (frontend only)

```sh
cd apps/admin-web
npm install
npm run dev
```

If you prefer staying Docker-first, `make lint` now runs the frontend linter inside the `admin-web` container instead of requiring host-installed dependencies.

## Vuetify MCP

- The repo root includes a `.mcp.json` entry for the hosted Vuetify MCP server at `https://mcp.vuetifyjs.com/mcp`.
- The frontend package also includes local scripts:

```sh
cd apps/admin-web
npm run mcp:vuetify
npm run mcp:vuetify:http
```

- If your IDE prefers user-level MCP configuration, the official `@vuetify/mcp` docs support `npx -y @vuetify/mcp config --remote` for the hosted server or `npx -y @vuetify/mcp config` for a local stdio setup.
