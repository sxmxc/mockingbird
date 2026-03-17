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
- Admin auth now uses DB-backed dashboard users plus bearer session tokens, with a one-time bootstrap account created on first init.
- OpenAPI can be rebuilt on every request; caching is secondary.
- `response_schema` is now the single source of truth for response shape and mock behavior via `x-mock` extensions.

## Current Status Snapshot
- Docker Compose starts a working Postgres, FastAPI API, and Vite admin app with `make up`.
- The backend exposes session-authenticated admin routes, DB-backed dashboard-user management, forced password rotation for bootstrap/reset credentials, DB-driven runtime dispatch, live OpenAPI generation, and an authenticated response preview endpoint.
- The admin account deletion path now removes all historical `adminsession` rows before deleting the user, so revoked or expired logins cannot strand dashboard accounts behind Postgres foreign-key errors.
- The backend now reserves `/api/admin` plus other system-owned public paths like `/api` and `/api/reference.json`, so DB-defined mock endpoints cannot trespass into private or framework-owned route space.
- The backend now manages SQLModel sessions through a yielded request-scoped dependency plus a shared context manager, which prevents leaked connections from exhausting the Postgres pool under sustained traffic.
- The backend now also exposes a branded Mockingbird landing page at `/` and `/api`, plus a live `/api/reference.json` feed backed directly by the current endpoint catalog.
- The public landing page now treats the opening viewport as a real full-screen hero, prefers explicit `hero-top.*` and `hero-bottom.*` artwork files from `apps/api/static/landing/`, pins immediately beneath a fixed topbar, and places the headline/copy in a wide translucent overlay band near the top of the art.
- The public hero now uses separate top and bottom frame assets when available, falling back to the older single tall `hero.*` file only if the split pair is missing, and keeps the desktop copy band much wider so the headline and warning line are less vertically cramped.
- The public hero once again carries the small `WARNING: The API may sometimes mock back.` callout, and the headline/copy now lean into Mockingbird's dry humor instead of generic sample-data language.
- The quick reference under the hero now renders as a Bulma-based paginated table with sticky headers, method/category/search filtering, modal example payloads, and a client-persisted light/dark toggle.
- The public quick reference now stays closer to stock Bulma styling, with a flatter table shell and simpler modal/filter controls so the branded surface feels less custom-overdesigned.
- The public quick reference now keeps category/status chips legible in both themes, color-codes status badges by HTTP family, and leaves example modals open until the user explicitly dismisses them.
- The public quick reference now shows generated request payloads alongside generated responses for POST/PUT/PATCH routes, while read-only routes continue to show response-only examples.
- The public sample-payload modal now lets long JSON strings wrap inside the modal body instead of creating a second inner scrollbar inside the payload `<pre>`.
- Seed data loads a 15-endpoint catalog, and `make seed` / `make test` work in Docker.
- The repo now also includes a local production-like Compose path through `docker-compose.prod-local.yml` plus `make up-prod-local`, which builds the local `runtime` targets, serves the admin app through Nginx, drops backend hot reload, and recreates the same local Compose stack in place while reusing the dev database volume.
- The frontend now runs on Vue + Vuetify, with a dedicated login flow, protected catalog/settings routes, a dedicated schema studio route, light/dark theme toggle, catalog search/filtering, and a Vuetify-first drag-and-drop builder surface.
- The admin frontend now stores bearer session tokens instead of raw passwords, redirects bootstrap/reset accounts into a mandatory password-rotation screen, and exposes a superuser-only dashboard-user management surface.
- The admin catalog/settings flow now supports endpoint duplication, opening a prefilled disabled copy with adjusted name/slug/path so teams can branch an existing route without immediately shadowing the live one.
- The admin endpoint workspace now keeps its shared shell mounted across browse/create/edit route changes, so switching records animates the right-hand content panel instead of fading the whole page.
- The admin catalog now refreshes in the background every 30 seconds while visible, also resyncs on focus/online once stale, keeps the last good route list rendered on refresh failures, and preserves the currently selected route row while its settings draft is dirty so unsaved edits are not clobbered.
- The desktop admin catalog rail now uses a bounded scroll region plus client-side pagination, which keeps long endpoint lists from stretching the workspace or pushing the main editor out of position.
- The catalog search input now opts out of flex growth, so sparse paginated route pages no longer stretch the search box to fill leftover rail height.
- The route settings form no longer exposes `slug`; admin create/update now auto-generate a unique internal slug from the route name so seed/import bookkeeping can keep using slugs without making users manage them.
- The backend now treats `request_schema` as a backward-compatible request contract: the JSON body schema stays at the root, while optional `x-request.path` and `x-request.query` object schemas store request-parameter metadata, path placeholders resync from the saved route path, and OpenAPI publishes those sections as operation parameters instead of folding them into `requestBody`.
- OpenAPI now falls back to `string` for route placeholders that do not yet have explicit `x-request.path` metadata, and response-side route-value links only adopt typed path-parameter constraints when the request editor actually saved those definitions.
- The admin browse flow now supports full route-catalog export/import through a native Mockingbird JSON bundle, with backend dry-run previews, `create_only` / `upsert` / `replace_all` modes, and explicit replace-all confirmation before missing routes are deleted.
- The CI Docker smoke test now seeds `.env` from `.env.example` before invoking Compose, so GitHub Actions no longer fails teardown/bootstrap in clean checkouts that do not include a local `.env`.
- GitHub Actions now runs backend tests, frontend lint/test/build, and a Docker Compose smoke test on `main` pushes and pull requests, while a separate image workflow validates runtime images on PRs and publishes multi-arch `linux/amd64` + `linux/arm64` images to GHCR on `main` and `v*` tags.
- The repo now includes a `deploy/docker-compose.ghcr.yml` example plus `deploy/.env.ghcr.example` so teams can run the stack from published GHCR images without cloning the full source tree.
- The seeded device catalog now defaults `deviceId` to UUID-style IDs and constrains `model` to the curated device-model enum list in both the list/detail device schemas.
- The sign-in screen now uses a simpler single-column studio welcome above the form, with more human-facing copy and less implementation-heavy onboarding text.
- The schema studio now uses draggable Vuetify chips for palette actions, a left-rail inspector, a dedicated preview rail, response preview regeneration, and a separate public-route preview page.
- The schema-studio live preview rail now renders both the sample response and JSON Schema tabs as syntax-highlighted JSON panes with internal scrolling and inline copy actions, and the `<pre>` markup is kept whitespace-tight so the previewer does not grow phantom blank lines above the JSON.
- Linking a response field to a saved route path parameter in the schema studio now preserves the field's existing scalar type and JSON Schema constraints instead of rebuilding it as a string, so response contracts and OpenAPI previews stay stable for integer/number/boolean fields too.
- The schema studio request side now splits authoring into `JSON body`, `Path params`, and `Query params` tabs; path parameter names are derived from the saved route path, query parameters use a dedicated flat editor, and the route-preview screen now sends non-empty query-string values alongside path replacements and optional JSON bodies.
- The response editor now receives the live request-side path parameter definitions instead of bare placeholder names, so dropping a route-value pill can inherit request-path type/format hints, preview samples use smarter path defaults such as UUIDs and bounded string lengths, and linked response fields hide the duplicate string-length inputs so the request path editor remains the source of truth for those constraints.
- The schema-studio Vitest coverage now finds canvas nodes through the row-level `data-node-id` buttons instead of generic text matches, so route-value pills like `deviceId` no longer make frontend CI fail with duplicate-text lookup errors.
- Mocking-mode string generation now speaks in a sharper, more sarcastic Mockingbird voice with snarkier generic text, companies, and slug fragments while staying deterministic under seeded previews.
- The schema studio now also combines palette/root-shape controls into a single builder-tools rail card, keeps selected-node context visible above the canvas, folds response seed controls into the preview rail, and lets response authors flip between generated output and live JSON Schema without leaving that rail.
- The schema studio canvas now renders as a connected pill tree with compact plus-icon insertion anchors, and drag/drop reorder works again by carrying explicit browser drag payloads plus before-sibling row insertion handling.
- The schema studio now also gives more desktop space to the canvas, uses slimmer higher-contrast builder pills, keeps row insertion anchors inline with each child rail, and exposes explicit end-of-branch anchors for appending to the bottom of an object level.
- The schema studio builder tools now separate structural node pills from response-only value behavior and value type pills, remove the old armed-tool/root-shape redundancy, and let scalar response nodes accept semantic drops directly on a dedicated value lane.
- Response value types now drive the primary scalar authoring flow: semantic value drops can coerce the leaf node into a compatible scalar type and infer string formats automatically instead of exposing a separate top-level format control in the canvas mental model.
- The schema studio canvas now uses smaller key/value pills, type-specific lead icons such as braces for object nodes, aligned branch-end add anchors, and a custom pill-shaped drag ghost so dragging feels like moving a tool instead of a browser screenshot.
- The schema studio now also restores the `Live preview` label, simplifies the schema-page hero copy down to endpoint-specific context, and labels array edits as `Item shape` in the inspector so arrays stop reading like generic multi-child containers.
- The admin and public surfaces now use more task-first language around routes, schema, and testing, replacing much of the old `studio`/`rail`/`payload` narration with simpler route-focused labels.
- Response schema editing now surfaces route-parameter pills derived directly from the saved route path, so scalar response fields can echo live path values while OpenAPI still publishes those placeholders automatically as required path inputs.
- The response value palette now includes `Username` and `Password` semantic string generators alongside the existing email/URL/name-style types.
- The `Password` response value type now emits bcrypt-style hash strings in both preview and runtime generation, so demo payloads do not leak cleartext-looking passwords.
- The route details form now uses a `v-combobox` chip input for tags with clearable chips, instead of a comma-delimited plain text field.
- The admin UI now defaults its main Vuetify controls to compact density, and disabled route status chips use the error palette instead of low-contrast surface colors.
- Frontend coverage now exercises schema-studio drag/drop, response-preview auth expiry, and auth session restore/login behavior through dedicated Vitest coverage instead of relying only on the older catalog/tree utility tests.
- Frontend coverage now also includes a reorder regression for the schema canvas, protecting the new row-anchor insertion flow that moves a node before the targeted sibling.
- Response nodes now support static, true-random, and mocking-random generation modes, and the seeded quote endpoints use the mocking mode to showcase the product voice.
- Response nodes now also store an explicit semantic mock value type, so random and mocking generation can stay context-aware for values like IDs, names, first names, emails, prices, and longer quote/message-style strings.
- Runtime preview generation now normalizes older stored response schemas before sampling, so legacy quote/message fields that were previously saved as plain `text` still produce long-text examples on the public homepage and live mock routes.
- The catalog/settings surface keeps general endpoint metadata and runtime behavior separate from schema editing, so the builder no longer competes with the record settings form on one page.
- The admin app now scrolls inside the main content shell instead of the browser window, so the fixed top bar owns the full top edge and desktop scrollbars start below the header.
- Navigating between major admin routes now resets the main content shell scroll position, so schema studio and preview pages do not inherit a stale scroll offset from the previous screen.
- The admin endpoint workspace now lets the catalog card own the full left rail without the old "Workspace ready" intro widget, pins that catalog rail within the main content shell on desktop with its own internal list scroll, and leaves the right-hand settings form on the main content scroll.
- The schema studio now keeps the left palette/root-shape/inspector cards intact, pins that full rail within the 3-column workspace, and lets it scroll as one column without making the canvas and preview columns move just because the inspector gets long.
- The endpoint catalog now uses a denser two-line card treatment with a compact method badge, inline route/category metadata, and a roomier horizontal status/action cluster so more records fit without feeling cramped.
- API startup now runs `alembic upgrade head`, and the first revision migrates legacy `example_template` / `response_mode` rows into the unified schema-builder contract.
- Frontend coverage now includes schema-tree utility tests plus a Vue component smoke test for the Vuetify catalog search flow under Vitest.
- Frontend startup now refreshes the Dockerized `node_modules` volume automatically when `package-lock.json` changes, which reduces bind-mount drift and local permissions headaches.
- The repo now includes a project-level Vuetify MCP config and frontend scripts for running the local Vuetify MCP server when needed.
- The Dockerfiles now expose separate `dev` and `runtime` targets so local Compose can stay hot-reload friendly while CI/CD publishes production-ready API and static-admin images.
- The API runtime version now comes from `APP_VERSION`, which lets release images stamp OpenAPI metadata with the published version, and the admin runtime image serves its built SPA through Nginx with a configurable `API_UPSTREAM`.
- The dependency audit pass now targets Python 3.12 and Node 24 across Docker, local version files, and GitHub Actions; the backend runs on FastAPI 0.135 + Pydantic 2 + SQLModel 0.0.37, the frontend runs on Vite 8, workflow badges live in the README, and both `pip-audit` and `npm audit` are currently clean.
- The admin frontend now also uses ESLint 10 flat config with current Vue parser/plugin packages, and `npm ci` no longer emits the old `eslint` / `rimraf` / `glob` / `inflight` deprecation warnings during container startup.
- The GitHub wiki now lives in the separate `mockingbird.wiki` repository as a curated user/developer handbook, while `README.md` and `docs/` remain the canonical source of truth.

## Known Risks
- Live OpenAPI generation may become slow if not cached.
- Drag-and-drop schema editing is meaningfully more complex than the old textarea editor, so tree-state regressions are still worth watching closely.
- The new pill-tree canvas depends on small icon-only insertion anchors, so future UX passes should keep keyboard/accessibility affordances in view while refining drag/drop.
- Semantic value-type drops can intentionally coerce scalar leaf types to a compatible schema type, so future UX changes should keep those mappings obvious in both the canvas and inspector.
- The builder now uses custom drag images for pills, so future drag/drop changes should preserve that feel instead of accidentally falling back to the browser's default clipped drag screenshot.
- Arrays still serialize to one JSON Schema `items` shape, so the editor should keep reinforcing that “one item template” model instead of exposing generic object-style child language around array authoring.
- Arrays in the schema studio still model one repeated item shape via JSON Schema `items`; the array-level end anchor sets or replaces that shape rather than authoring tuple-style `prefixItems`.
- The public landing page currently uses lightweight polling for the live quick reference rather than websockets or SSE.
- The public landing page hero still depends on approved artwork being dropped into `apps/api/static/landing/hero.*`.
- Admin UI and backend need to stay in sync on model schemas.
- Fresh installs still need an operator to capture the bootstrap password from `ADMIN_BOOTSTRAP_PASSWORD` or the API startup logs and rotate it promptly.
- Request parameter modeling currently supports flat scalar/enum path and query fields only; nested object/array parameters and advanced OpenAPI serialization styles are still out of scope.
- Slugs remain part of the backend endpoint model for seeding and bookkeeping, so future imports/scripts should keep treating them as internal identifiers rather than reintroducing them into the user-facing route form.
- Catalog imports currently match existing routes by normalized `method + path`, so path/method renames behave like new routes unless operators use `replace_all`.
- Vitest/jsdom still prints repeated `Could not parse CSS stylesheet` warnings when rendering Vuetify-heavy components, even though the frontend tests pass.
- The `SchemaEditorWorkspace` Vitest file can still be annoyingly sticky under Vuetify/jsdom noise; utility tests, lint, and typecheck are currently reliable, but the component suite remains part of the broader CSS-noise cleanup task.
- Local arm64 validation works through a temporary buildx/QEMU builder, but it is meaningfully slower than native amd64 builds because the admin runtime image has to cross-compile the full Vite bundle.

## Notes for Next Agent
- Keep tasks updated in `TASKS.md` as progress is made.
- Focus next on richer simulation UX around latency/error scenarios and the lingering Vuetify/jsdom CSS parse noise now that request parameter modeling is in place.
- Browser QA for catalog refresh should confirm that background sync updates non-selected routes, retains the last good list on refresh errors, and does not reset a dirty selected route form mid-edit.
- Browser QA for schema-studio reorder should use the row-level plus anchors for "insert before" moves and the inline plus anchors for "append into container" moves; both paths are now covered by the same drag payload contract.
- Browser QA for schema-studio append-at-end should use the dashed tail anchors under object branches, while array tail anchors intentionally replace the one repeated item shape instead of adding tuple-array siblings.
- Browser QA for schema-studio scalar semantics should drag response-only behavior and value-type pills onto the green value lane; drops like `price` may intentionally coerce the leaf node to `number` while also inferring the matching semantic generator/format.
- Browser QA for request-schema parameters should use a route with placeholders such as `/api/devices/{deviceId}`, confirm path parameter names resync when the route path changes, verify query parameters round-trip through save/load, and check that the preview page appends only non-empty query values to the public request URL.
- Browser QA for route-catalog import/export should validate bundle download from browse mode, dry-run preview counts for `upsert`, and the explicit confirmation/deletion flow for `replace_all`.
- Local persistent dev databases may no longer accept the bootstrap credential pair from `.env`; after the first init, browser QA should use a current dashboard-user password or a freshly created local admin account instead of assuming `admin/admin123` still works.
- Compose startup now invokes bind-mounted scripts through `sh`, and Postgres health checks probe `POSTGRES_DB` with password auth.
- Python helper scripts should be executed with `python -m ...` from `/app` so package imports resolve consistently in Docker.
- The frontend uses a named `/app/node_modules` volume so bind mounts do not hide installed Vite dependencies.
- The frontend and public brand now use the shared `mockingbird-icon.svg` mascot as the primary logo and favicon surface, while older bird-mark assets remain only for compatibility.
- The API image now installs dev dependencies too, so `make test` and `make lint` work against the same Dockerized backend environment.
- Pytest filters a known third-party `python_multipart` pending deprecation warning so local verification output stays focused on project issues.
- The frontend Vite dev server now supports env-driven `FRONTEND_ALLOWED_HOSTS` and `FRONTEND_DEV_PROXY_TARGET` for remote-host access and Docker-safe API proxying.
- The frontend lint config now lives in `apps/admin-web/eslint.config.mjs`; the older `.eslintrc` file is gone.
- The GitHub wiki is intentionally user/developer focused and should stay aligned with the repo docs rather than duplicating agent process logs or architecture decision records.
- Public landing artwork should be added under `apps/api/static/landing/`; the backend prefers matching `hero-top` and `hero-bottom` assets and otherwise falls back to the first matching `hero` asset across `.svg`, `.png`, `.jpg`, `.jpeg`, `.webp`, or `.avif`.
- The admin frontend now targets Node 24+ locally, and the repo root includes `.node-version` / `.python-version` files to keep local runtimes aligned with CI and Docker.
- Response schemas may contain internal `x-mock` and `x-builder` keys for generation and tree ordering; public OpenAPI strips those keys before publishing.
- Alembic lives under `apps/api/migrations/`, and both `start.sh` and `scripts/seed.sh` run the migration bootstrap before serving or seeding.
- Active admin sessions now live in `sessionStorage`, while the explicit remember-me path additionally copies a bearer session token to `localStorage` so page refreshes stay smooth without persisting the raw password in the browser.
- Admin bootstrap now uses `ADMIN_BOOTSTRAP_USERNAME` / `ADMIN_BOOTSTRAP_PASSWORD`; leaving the password blank generates a one-time value in the API startup logs and forces a password change on first sign-in.
- Vuetify MCP is configured at the repo root via `.mcp.json`, and the frontend package exposes `npm run mcp:vuetify` plus `npm run mcp:vuetify:http` for local MCP usage.
- Official container images now follow a tag-driven release scheme: `vX.Y.Z` tags publish semver image tags plus `latest`, while default-branch builds publish branch/`edge`/`sha-*` tags alongside uploaded image metadata artifacts and provenance attestations.
- The standalone deployment example targets `ghcr.io/sxmxc/mockingbird-api` and `ghcr.io/sxmxc/mockingbird-admin-web`, defaults to `IMAGE_TAG=edge`, and should be pinned to a numbered release tag for production use.
- `make up` can still fail locally if another Mockingbird checkout is already bound to ports `8000` and `3000`; the compose files themselves now build cleanly on the upgraded runtime line.
