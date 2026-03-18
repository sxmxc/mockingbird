# Architecture

Mockingbird is built as a **monorepo** with a public API surface and a private admin studio.

## Core components

- **Backend (`apps/api/`)**
  - FastAPI application serving two sets of endpoints:
    - **Admin API**: bearer-session auth, dedicated account-profile endpoints, password rotation, explicit admin roles/permissions, dashboard-user management, and CRUD operations for mock endpoints and configuration.
    - **Public mock API**: dynamically routed endpoints based on DB definitions.
    - **Public landing/reference**: a branded homepage at `/` and `/api` plus `/api/reference.json`, both driven from the same live endpoint catalog. The landing hero can read approved frame artwork from `apps/api/static/landing/`.
  - **Postgres** is used as the single source of truth for endpoint definitions.
  - Private admin path space such as `/api/admin` is reserved and cannot be claimed by DB-backed public mock endpoints.
  - Baseline browser hardening headers now ship from the FastAPI layer, while the admin frontend mirrors them in both Vite dev and the runtime Nginx image.
  - **OpenAPI generation** is performed at runtime from the active endpoint catalog.
  - **Mock generation** supports fixed, true-random, and mocking-random response values from `response_schema`, explicit semantic value types for context-aware data like IDs, names, emails, prices, and long-form text fields, request-aware string templating through `x-mock.template`, and a deliberately snarkier Mockingbird voice in `mocking` mode.
  - Public route matching now escapes static path text before translating `{param}` placeholders, and the async public catchall offloads sync DB/sample-generation work to worker threads so runtime traffic does not block the event loop on SQLModel I/O.

- **Frontend (`apps/admin-web/`)**
  - Vue + Vite + Vuetify admin dashboard.
  - Provides endpoint catalog management, a dedicated schema studio, preview tools, a personal profile flow, superuser-only user management, and auth-protected admin workflows with role-aware UI gating.
  - The schema studio is now intentionally pivoting from a bespoke pill-tree drag/drop surface toward a canvas-first architecture, with `Vue Flow` as the leading frontend foundation, while preserving the existing backend JSON Schema contracts.
  - Local Docker development uses a Vite-based `dev` image target, while release builds package the compiled SPA behind Nginx in a separate `runtime` target.

- **Orchestration**
  - Uses Docker Compose for local and QA profiles.
  - Services include: Postgres, backend, frontend.
  - GitHub Actions additionally validates runtime images and publishes multi-arch GHCR artifacts for CI/CD.

## Data flow
1. Admin user creates/edits endpoint definitions via the UI.
2. Backend persists definitions in Postgres.
3. The public landing page and `/api/reference.json` read the active catalog directly from the database for a live quick reference, including generated response samples and generated request payload samples for body-based routes.
4. The mock API router uses those same definitions to route requests and generate responses.
5. OpenAPI schema is generated from the same definitions and served on `/openapi.json`.
