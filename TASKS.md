# TASKS

This file tracks the work needed to bootstrap and evolve the project.

## Now
- [ ] Add broader frontend coverage for schema drag/drop, preview, and auth journeys
- [ ] Add background refresh or smarter cache invalidation for the admin catalog

## Next
- [ ] Expand the request builder beyond JSON bodies to path/query parameter modeling
- [ ] Add richer simulation UX around latency/error scenarios
- [ ] Reduce or eliminate Vuetify/jsdom CSS parse noise during frontend tests
- [ ] Refine the public landing page quick reference with richer try-it tooling or grouped filtering if the catalog grows

## Later
- [ ] Add advanced auth (API key, bearer token, scopes)
- [ ] Add role-based access to admin UI
- [ ] Improve OpenAPI caching strategy for performance
- [ ] Add multi-project support (namespaces)

## Blocked
- [ ] (none)

## Done
- [x] Create initial planning docs
- [x] Define project structure and high-level architecture
- [x] Scaffold backend FastAPI app and ensure it runs inside Docker
- [x] Scaffold frontend admin UI (Vite + React) and ensure it runs inside Docker
- [x] Implement core endpoint definition model + CRUD API
- [x] Implement runtime dispatch for mock endpoints driven by DB
- [x] Implement live OpenAPI generation from DB definitions
- [x] Seed initial endpoint catalog (15 endpoints)
- [x] Add baseline backend tests for bootstrap and OpenAPI generation
- [x] Stabilize Docker Compose bootstrap and startup scripts for local development
- [x] Make frontend Vite dev access configurable for remote hosts and Docker proxying
- [x] Refresh project tracking docs to match the implemented bootstrap state
- [x] Expand backend tests to cover admin CRUD endpoints and runtime dispatch behavior
- [x] Build real admin UI pages for endpoint list / edit / preview
- [x] Connect the admin UI to the backend CRUD API with basic-auth support
- [x] Add schema editor UI (JSON editor) for request/response schemas
- [x] Improve admin auth UX in the frontend (login flow, credential handling, logout)
- [x] Replace schema textareas with a drag-and-drop request/response schema builder
- [x] Add schema-driven random response generation and admin preview support
- [x] Switch backend bootstrap to Alembic migrations with legacy contract conversion
- [x] Migrate the admin UI to Vue + Vuetify with a dedicated schema editor page
- [x] Add search and filtering to the endpoint catalog
- [x] Add latency/error simulation controls to the admin settings UI
- [x] Add the public Mockingbird landing page with a live endpoint quick reference
- [x] Add mocking-style random generation alongside static and true-random schema values
- [x] Fix schema canvas selection so the inspector follows nested node clicks
- [x] Keep Dockerized frontend dependencies isolated from host `node_modules`
- [x] Refine the public landing page into a full-height hero with shared artwork hooks
- [x] Wire the public landing page to a single tall `hero` artwork asset
- [x] Add semantic mock value types so random and mocking fields stay context-aware
- [x] Refine the schema studio layout so the inspector sits in the left rail and the right rail stays preview-focused
- [x] Fix backend DB session lifecycle so request handling does not exhaust the SQLAlchemy connection pool
- [x] Rework the public quick reference into a paginated table with filters, modal examples, sticky headers, and dark mode
- [x] Simplify the public quick reference styling so it stays closer to stock Bulma
- [x] Add request-and-response examples for public POST-style endpoints in the landing-page quick reference
- [x] Add endpoint duplication support in the UI
- [x] Keep the endpoint workspace shell mounted while only the right-hand record pane transitions between records
- [x] Make the endpoint catalog rail scroll independently with client-side pagination
- [x] Update repository and deployment references after the GitHub rename to Mockingbird
- [x] Fix CI Docker smoke test bootstrap when `.env` is absent in GitHub Actions
- [x] Add a dedicated long-text value type for schema-studio string fields
- [x] Simplify the admin sign-in page with friendlier copy and a single-column intro/form flow
- [x] Stabilize GitHub Actions CI and add multi-arch image publishing for CI/CD
- [x] Add a standalone GHCR-backed Docker Compose example for image-only deployments
- [x] Audit and refresh repo runtimes, dependencies, Docker bases, and GitHub Actions versions; add README workflow badges
- [x] Remove admin-web `npm ci` deprecation warnings by migrating the lint stack to flat config and overriding the test-only `glob` path
- [x] Remove the admin workspace intro card, move desktop scrolling below the top bar, and tighten the admin left-rail behavior
- [x] Redesign the endpoint catalog cards into a denser, more scannable layout and normalize schema-studio shell scrolling
- [x] Create and populate the GitHub wiki as a curated user/developer handbook, while keeping repo docs canonical
- [x] Harden admin auth with managed dashboard users, password rotation, bearer sessions, and reserved private route validation
- [x] Fix admin-user deletion so historical admin sessions do not block account removal
