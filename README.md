# Mockingbird

A Docker-first mock API platform with a live public landing page, dynamic OpenAPI, a private admin dashboard, and configurable endpoint mocking. Designed for developers who want realistic API shapes with a little personality.

## 🚀 Quickstart (Local)

1. Copy `.env.example` to `.env` and adjust as desired.
2. Start services:

```sh
make up
```

3. Open the product surfaces:

- Public API landing page: http://localhost:8000
- Admin dashboard: http://localhost:3000
- OpenAPI JSON: http://localhost:8000/openapi.json
- FastAPI docs: http://localhost:8000/docs

If you access the frontend through a remote host or internal DNS name, add it to `FRONTEND_ALLOWED_HOSTS` in `.env`. When the frontend runs in Docker, keep `FRONTEND_DEV_PROXY_TARGET=http://api:8000`.

## 🧠 What You Get

- **Dynamic mock API**: endpoints defined in Postgres are served dynamically.
- **Public landing page**: `/` and `/api` now render a full-height Mockingbird hero sourced from split top/bottom artwork frames, with a Bulma-based quick-reference table, filtering, pagination, modal example payloads, and a light/dark theme toggle.
- **Live OpenAPI**: `/openapi.json` reflects the active endpoint catalog.
- **Admin API**: basic-auth CRUD routes manage endpoint definitions in Postgres.
- **Seed catalog**: `make seed` loads 15 sample endpoints for local exploration, including device examples that now use UUID-style `deviceId` values and a curated default model enum.
- **Admin UI**: Vue + Vuetify endpoint studio now includes a dedicated sign-in flow, protected catalog/settings routes, a separate schema editor page, light/dark theme toggle, skeleton loading states, search/filtering, drag-and-drop schema editing, and live previews of generated/public mock responses.
- **Schema-driven generation**: response schemas can mix static values, true random generation, and mocking-style random generation per field via internal `x-mock` extensions, with semantic value types like `id`, `name`, `email`, `price`, and `long_text`.
- **Vuetify AI support**: the frontend uses `@vuetify/v0` for theme/storage helpers and ships with a repo-level Vuetify MCP config.
- **Docker-first**: one command to bring up the full stack without depending on host `node_modules` for the frontend container.

## Public artwork

Drop approved public-landing artwork into:

- `apps/api/static/landing/hero-top.svg`
- `apps/api/static/landing/hero-bottom.svg`

Keep the preferred files the same size, ideally `1920x1080`. The public API also accepts `.png`, `.jpg`, `.jpeg`, `.webp`, or `.avif` variants for those filenames, and still falls back to a single tall `hero.*` asset if the split pair is not present.

## 📦 Architecture

- **Backend**: FastAPI + SQLModel + Postgres
- **Frontend**: Vue + Vite + TypeScript + Vuetify
- **DB migrations**: Alembic
- **Orchestration**: Docker Compose

## 🚢 CI/CD

- GitHub Actions CI now runs backend tests, frontend lint/test/build, and a Docker Compose smoke test on `main` pushes and pull requests.
- Runtime container images are built from dedicated `runtime` Docker targets rather than the local hot-reload targets used by `make up`.
- The image workflow validates runtime images on pull requests and publishes multi-arch `linux/amd64` + `linux/arm64` images to GHCR on `main` and `v*` tags.
- Release tags follow `ghcr.io/<owner>/<repo>-api` and `ghcr.io/<owner>/<repo>-admin-web` with:
  - `vX.Y.Z`, `X.Y`, `X`, and `latest` for semver tags
  - branch, `edge`, and `sha-<commit>` tags for default-branch builds
- Each image build also uploads metadata artifacts and provenance so digests/tags are easy to inspect in Actions.

## 📁 Repo layout

- `apps/api/` - Backend implementation
- `apps/admin-web/` - Admin UI
- `apps/api/migrations/` - Alembic migrations
- `apps/api/scripts/` - DB init and seed scripts
- `docs/` - Architecture, strategy, and how-tos
- `deploy/` - Standalone deployment examples that reference published GHCR images
- Root tracking docs - `TASKS.md`, `MEMORY.md`, `DECISIONS.md`

See `docs/ci-cd.md` for the release workflow, image tag rules, and runtime environment notes.

## 🐳 Image-only Compose Example

If you want to run Mockingbird without cloning the full repo, start from:

- `deploy/docker-compose.ghcr.yml`
- `deploy/.env.ghcr.example`

Those files point at:

- `ghcr.io/sxmxc/cuddly-octo-memory-api`
- `ghcr.io/sxmxc/cuddly-octo-memory-admin-web`

The default `IMAGE_TAG=edge` tracks the latest default-branch publish. For release deployments, prefer an explicit tag such as `IMAGE_TAG=1.2.3`.

## 🧩 Next steps

Check `TASKS.md` for what to work on next.
