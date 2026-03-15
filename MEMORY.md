# MEMORY

## Project Purpose
Provide a Docker-first platform to define and serve configurable mock APIs with realistic shapes, funny output values, and a polished public-facing surface. The platform is centered around a clean private admin UI, a live public quick reference, and dynamic OpenAPI generation.

## Current Architecture
- **Backend**: FastAPI with SQLModel + Alembic, running in Docker
- **Database**: Postgres for endpoint definitions and persistence
- **Frontend**: Vue + Vite + Vuetify admin dashboard with `@vuetify/v0` theme/storage helpers
- **Orchestration**: Docker Compose (local + QA profiles)

## Constraints
- Must be Docker-first and easy to run.
- Must use Postgres (no SQLite).
- Endpoint definitions are stored in DB and drive both runtime behavior and OpenAPI.
- Keep implementation pragmatic and “good enough” for v1.

## Active Assumptions
- Admin auth uses Basic Auth for v1.
- OpenAPI can be rebuilt on every request; caching is secondary.
- `response_schema` is now the single source of truth for response shape and mock behavior via `x-mock` extensions.

## Current Status Snapshot
- Docker Compose starts a working Postgres, FastAPI API, and Vite admin app with `make up`.
- The backend exposes basic-auth admin CRUD routes, DB-driven runtime dispatch, live OpenAPI generation, and an authenticated response preview endpoint.
- The backend now manages SQLModel sessions through a yielded request-scoped dependency plus a shared context manager, which prevents leaked connections from exhausting the Postgres pool under sustained traffic.
- The backend now also exposes a branded Mockingbird landing page at `/` and `/api`, plus a live `/api/reference.json` feed backed directly by the current endpoint catalog.
- The public landing page now treats the opening viewport as a real full-screen hero, prefers explicit `hero-top.*` and `hero-bottom.*` artwork files from `apps/api/static/landing/`, pins immediately beneath a fixed topbar, and places the headline/copy in a wide translucent overlay band near the top of the art.
- The public hero now uses separate top and bottom frame assets when available, falling back to the older single tall `hero.*` file only if the split pair is missing, and keeps the desktop copy band much wider so the headline and warning line are less vertically cramped.
- The quick reference under the hero now renders as a Bulma-based paginated table with sticky headers, method/category/search filtering, modal example payloads, and a client-persisted light/dark toggle.
- The public quick reference now stays closer to stock Bulma styling, with a flatter table shell and simpler modal/filter controls so the branded surface feels less custom-overdesigned.
- The public quick reference now keeps category/status chips legible in both themes, color-codes status badges by HTTP family, and leaves example modals open until the user explicitly dismisses them.
- The public sample-payload modal now lets long JSON strings wrap inside the modal body instead of creating a second inner scrollbar inside the payload `<pre>`.
- Seed data loads a 15-endpoint catalog, and `make seed` / `make test` work in Docker.
- The frontend now runs on Vue + Vuetify, with a dedicated login flow, protected catalog/settings routes, a dedicated schema studio route, light/dark theme toggle, catalog search/filtering, and a Vuetify-first drag-and-drop builder surface.
- GitHub Actions now runs backend tests, frontend lint/test/build, and a Docker Compose smoke test on `main` pushes and pull requests, while a separate image workflow validates runtime images on PRs and publishes multi-arch `linux/amd64` + `linux/arm64` images to GHCR on `main` and `v*` tags.
- The repo now includes a `deploy/docker-compose.ghcr.yml` example plus `deploy/.env.ghcr.example` so teams can run the stack from published GHCR images without cloning the full source tree.
- The seeded device catalog now defaults `deviceId` to UUID-style IDs and constrains `model` to the curated device-model enum list in both the list/detail device schemas.
- The sign-in screen now uses a simpler single-column studio welcome above the form, with more human-facing copy and less implementation-heavy onboarding text.
- The schema studio now uses draggable Vuetify chips for palette actions, a left-rail inspector, a dedicated preview rail, response preview regeneration, and a separate public-route preview page.
- Response nodes now support static, true-random, and mocking-random generation modes, and the seeded quote endpoints use the mocking mode to showcase the product voice.
- Response nodes now also store an explicit semantic mock value type, so random and mocking generation can stay context-aware for values like IDs, names, first names, emails, prices, and longer quote/message-style strings.
- Runtime preview generation now normalizes older stored response schemas before sampling, so legacy quote/message fields that were previously saved as plain `text` still produce long-text examples on the public homepage and live mock routes.
- The catalog/settings surface keeps general endpoint metadata and runtime behavior separate from schema editing, so the builder no longer competes with the record settings form on one page.
- API startup now runs `alembic upgrade head`, and the first revision migrates legacy `example_template` / `response_mode` rows into the unified schema-builder contract.
- Frontend coverage now includes schema-tree utility tests plus a Vue component smoke test for the Vuetify catalog search flow under Vitest.
- Frontend startup now refreshes the Dockerized `node_modules` volume automatically when `package-lock.json` changes, which reduces bind-mount drift and local permissions headaches.
- The repo now includes a project-level Vuetify MCP config and frontend scripts for running the local Vuetify MCP server when needed.
- The Dockerfiles now expose separate `dev` and `runtime` targets so local Compose can stay hot-reload friendly while CI/CD publishes production-ready API and static-admin images.
- The API runtime version now comes from `APP_VERSION`, which lets release images stamp OpenAPI metadata with the published version, and the admin runtime image serves its built SPA through Nginx with a configurable `API_UPSTREAM`.

## Known Risks
- Live OpenAPI generation may become slow if not cached.
- Drag-and-drop schema editing is meaningfully more complex than the old textarea editor, so tree-state regressions are still worth watching closely.
- The public landing page currently uses lightweight polling for the live quick reference rather than websockets or SSE.
- The public landing page hero still depends on approved artwork being dropped into `apps/api/static/landing/hero.*`.
- Admin UI and backend need to stay in sync on model schemas.
- Remember-me mode still persists Basic Auth credentials client-side because the backend only exposes Basic Auth for v1; revisit once token/session auth exists.
- Request schema authoring still targets JSON request bodies only; query/path parameter modeling is a follow-up.
- Vitest/jsdom still prints repeated `Could not parse CSS stylesheet` warnings when rendering Vuetify-heavy components, even though the frontend tests pass.
- Local arm64 validation works through a temporary buildx/QEMU builder, but it is meaningfully slower than native amd64 builds because the admin runtime image has to cross-compile the full Vite bundle.

## Notes for Next Agent
- Keep tasks updated in `TASKS.md` as progress is made.
- Focus next on endpoint duplication, richer schema-studio coverage, request parameter modeling, and smarter catalog refresh behavior now that the Vue/Vuetify shell is in place.
- Compose startup now invokes bind-mounted scripts through `sh`, and Postgres health checks probe `POSTGRES_DB` with password auth.
- Python helper scripts should be executed with `python -m ...` from `/app` so package imports resolve consistently in Docker.
- The frontend uses a named `/app/node_modules` volume so bind mounts do not hide installed Vite dependencies.
- The frontend and public brand now use the shared `mockingbird-icon.svg` mascot as the primary logo and favicon surface, while older bird-mark assets remain only for compatibility.
- The API image now installs dev dependencies too, so `make test` and `make lint` work against the same Dockerized backend environment.
- Pytest filters a known third-party `python_multipart` pending deprecation warning so local verification output stays focused on project issues.
- The frontend Vite dev server now supports env-driven `FRONTEND_ALLOWED_HOSTS` and `FRONTEND_DEV_PROXY_TARGET` for remote-host access and Docker-safe API proxying.
- Public landing artwork should be added under `apps/api/static/landing/`; the backend prefers matching `hero-top` and `hero-bottom` assets and otherwise falls back to the first matching `hero` asset across `.svg`, `.png`, `.jpg`, `.jpeg`, `.webp`, or `.avif`.
- The admin frontend now expects Node 22+ when run locally because `@vuetify/v0` requires it.
- Response schemas may contain internal `x-mock` and `x-builder` keys for generation and tree ordering; public OpenAPI strips those keys before publishing.
- Alembic lives under `apps/api/migrations/`, and both `start.sh` and `scripts/seed.sh` run the migration bootstrap before serving or seeding.
- Active admin sessions now live in `sessionStorage`, while the explicit remember-me path additionally copies credentials to `localStorage` so page refreshes stay smooth without always making credentials durable.
- Vuetify MCP is configured at the repo root via `.mcp.json`, and the frontend package exposes `npm run mcp:vuetify` plus `npm run mcp:vuetify:http` for local MCP usage.
- Official container images now follow a tag-driven release scheme: `vX.Y.Z` tags publish semver image tags plus `latest`, while default-branch builds publish branch/`edge`/`sha-*` tags alongside uploaded image metadata artifacts and provenance attestations.
- The standalone deployment example targets `ghcr.io/sxmxc/cuddly-octo-memory-api` and `ghcr.io/sxmxc/cuddly-octo-memory-admin-web`, defaults to `IMAGE_TAG=edge`, and should be pinned to a numbered release tag for production use.
