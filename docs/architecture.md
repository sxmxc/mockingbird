# Architecture

Mockingbird is built as a **monorepo** with a public API surface and a private admin studio.

## Core components

- **Backend (`apps/api/`)**
  - FastAPI application serving two sets of endpoints:
    - **Admin API**: CRUD operations for mock endpoints and configuration.
    - **Public mock API**: dynamically routed endpoints based on DB definitions.
    - **Public landing/reference**: a branded homepage at `/` and `/api` plus `/api/reference.json`, both driven from the same live endpoint catalog. The landing hero can read approved frame artwork from `apps/api/static/landing/`.
  - **Postgres** is used as the single source of truth for endpoint definitions.
  - **OpenAPI generation** is performed at runtime from the active endpoint catalog.
  - **Mock generation** supports fixed, true-random, and mocking-random response values from `response_schema`, with explicit semantic value types for context-aware data like IDs, names, emails, prices, and long-form text fields.

- **Frontend (`apps/admin-web/`)**
  - Vue + Vite + Vuetify admin dashboard.
  - Provides endpoint catalog management, a dedicated schema studio, preview tools, and auth-protected admin workflows.
  - Local Docker development uses a Vite-based `dev` image target, while release builds package the compiled SPA behind Nginx in a separate `runtime` target.

- **Orchestration**
  - Uses Docker Compose for local and QA profiles.
  - Services include: Postgres, backend, frontend.
  - GitHub Actions additionally validates runtime images and publishes multi-arch GHCR artifacts for CI/CD.

## Data flow
1. Admin user creates/edits endpoint definitions via the UI.
2. Backend persists definitions in Postgres.
3. The public landing page and `/api/reference.json` read the active catalog directly from the database for a live quick reference.
4. The mock API router uses those same definitions to route requests and generate responses.
5. OpenAPI schema is generated from the same definitions and served on `/openapi.json`.
