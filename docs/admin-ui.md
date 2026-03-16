# Admin UI

The admin UI is a Vue + Vite + Vuetify application that lets users manage mock endpoints.

## Key screens
- **Login**: Dedicated sign-in screen for admin users, with concise route-focused copy, explicit remember-me behavior, and bootstrap-password guidance for fresh installs.
- **Catalog + settings**: Browse the live catalog, search/filter routes, and edit endpoint identity/runtime behavior without competing against the schema canvas.
- **Route form**: Route tags are authored through a chip-style tag box with removable pills instead of a plain comma-separated text field, and the form no longer exposes the internal `slug` field.
- **Schema editor**: Request/response builder route with a compact add-tools rail, separate field/value palettes, a connected pill-tree canvas with inline row anchors plus end-of-branch add targets, a left-rail settings panel, import/copy actions, response-side route-value pills derived from the saved path, and a live-preview panel that can flip between generated output and live JSON Schema.
- **Preview**: Call the public mock route with the configured method and path parameters to inspect the live response payload.
- **Security**: Change the signed-in user's password and, for superusers, create/edit/delete other admin users.

## API contract
The frontend communicates with the backend via the admin API under `/api/admin`.
- `POST /api/admin/auth/login`
- `GET /api/admin/auth/me`
- `POST /api/admin/auth/logout`
- `POST /api/admin/account/change-password`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/{id}`
- `DELETE /api/admin/users/{id}`
- `GET /api/admin/endpoints`
- `GET /api/admin/endpoints/{id}`
- `POST /api/admin/endpoints`
- `PUT /api/admin/endpoints/{id}`
- `DELETE /api/admin/endpoints/{id}`
- `POST /api/admin/endpoints/preview-response`

## UX notes
- Logged-out users should only see the sign-in journey; catalog/editor/preview/security controls should stay hidden until authentication succeeds.
- Active sessions live in browser `sessionStorage`; remember-me additionally copies a bearer session token to `localStorage` so reloads and restarts can restore the session without persisting the raw password.
- New bootstrap or reset passwords must be rotated through the dedicated security screen before endpoint CRUD or user-management routes unlock.
- The settings page and schema studio are intentionally separate so endpoint metadata/behavior edits do not crowd the schema authoring flow.
- The fixed top bar should own the full top edge of the admin app; desktop scrolling should happen inside the main content shell so the scrollbar starts below the header instead of beside it.
- Navigating between major admin surfaces should reset the main content shell back to the top, so routes like the schema studio do not inherit a half-scrolled workspace from the previous page.
- The endpoint catalog/settings workspace should keep the left rail and top-level shell mounted while switching between browse/create/edit records, leaving the visible transition scoped to the right-hand record pane.
- On desktop, the endpoint catalog rail should act like a bounded navigator with its own vertical scroll region and client-side pagination so long catalogs do not push the main editor down the page.
- The desktop endpoint workspace should let the catalog card fill the full left rail, pin that rail within the main content shell, and leave the right-hand settings pane on the main content scroll while the catalog list keeps its own internal scroll region.
- Endpoint list cards should stay compact and scannable: clear method badge, strong route name, one-line route/category metadata, and a balanced horizontal live-state/action cluster with enough breathing room to stay easy to scan.
- Disabled route badges should use the error palette consistently in route headers, preview headers, and list rows so a non-live route cannot masquerade as a neutral state.
- The desktop schema studio should keep a compact builder-tools rail plus inspector on the left, pin that rail within the 3-column workspace, and let the canvas own most of the middle-column height.
- The desktop schema studio should bias space toward the canvas rather than giving the preview rail equal visual weight, so authoring remains the dominant task on wide screens.
- The builder palette should separate structure from scalar semantics: node pills target the key rail, while response-only behavior and value-type pills target the scalar value lane.
- Route placeholders should surface in the response editor as draggable route-value pills, so scalar response fields can echo live URL segments without pretending those values belong to the request JSON body.
- Linking a route-value pill should preserve the selected scalar field's existing type and JSON Schema constraints, so the saved response contract and generated OpenAPI stay aligned while runtime previews coerce the incoming path segment.
- Root-shape changes should live on the selected node's inspector controls rather than being duplicated in the builder palette.
- Duplicating an endpoint should open the create flow with a prefilled copy, auto-adjust the name/path, and default the duplicate to disabled so the user can review it before publishing; the backend regenerates the internal slug from the copied name.
- The schema studio is builder-first: users drag Vuetify chip pills into a tree workspace, edit node settings in the left inspector rail, and use import/copy actions only as advanced helpers.
- The canvas tree should stay visually legible at a glance: each node renders as a compact pill with a type-specific lead icon, object/array relationships stay connected by guide lines, row plus anchors sit inline with the child rail for "insert before", and branch-end plus anchors stay aligned on that same rail for "append at end" actions.
- Dragging schema pills should feel like moving a pill, not like dragging a browser-clipped screenshot; custom drag ghosts should preserve the same visual language as the canvas and builder palette.
- Arrays in the schema studio currently describe one repeated item shape through JSON Schema `items`; the array controls should speak in terms of `Item shape`, and the array tail anchor sets or replaces that repeated item schema instead of creating tuple-style array siblings.
- Response nodes can be static, true-random, mocking-random, or linked to a saved route parameter per field; request nodes stay schema-only and intentionally omit mock controls.
- The response inspector exposes the currently selected behavior and semantic value type for scalar fields, while the primary canvas interaction lets users drag those semantics directly onto the value lane.
- Semantic value types should be the primary response-authoring language for scalar fields; compatible string formats and scalar type coercions should follow from that choice instead of forcing users to juggle parallel value-type and format concepts. Common auth/demo fields such as `Username` and `Password` should live directly in that palette instead of being hidden behind generic text.
- The response builder uses the authenticated preview API for live sample payloads, keeps `seed_key` controls in the live-preview panel itself, and only shows the manual regenerate action when no `seed_key` is set; request mode reuses that right rail as a live schema preview so the studio keeps a stable three-panel rhythm.
- Canvas selection should always drive the inspector directly; nested node clicks must update the active inspector target instead of bubbling back up to parent containers.
- The dedicated route-preview screen hits the public mock endpoint directly so runtime behavior matches the backend dispatcher, while schema-studio response preview uses the authenticated preview API for fast editor feedback.
- Validation runs both in the browser for basic field checks and in the backend when saving.
- Use skeleton states during session restore and initial catalog/editor loads to keep state transitions visually stable.
- Prefer Vuetify components wherever possible to keep styling, states, and interaction affordances consistent across the admin journey.
- Follow Vuetify's density guidance by defaulting interactive admin controls toward `compact` density unless a specific control needs more room for readability.
