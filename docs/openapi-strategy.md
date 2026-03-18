# OpenAPI Strategy

The OpenAPI spec must always reflect the active public mock endpoints stored in the database.

## Approach
- **Source of truth**: `EndpointDefinition` records in Postgres.
- **Generation**: Build the OpenAPI object dynamically on each request to `/openapi.json`.
- **Caching**: For v1, keep it simple and rebuild on demand; add caching later if performance becomes a concern.
- **Public alignment**: The branded landing page and `/api/reference.json` should read from the same active catalog so human-facing and machine-facing references do not drift.

## Key mechanics
- Each active endpoint becomes an OpenAPI path entry.
- The `method`, `path`, `summary`, `description`, and schemas drive the OpenAPI operation fields.
- Internal builder and generator extensions (`x-builder`, `x-mock`, including semantic mock value types and response-template metadata) are removed before publishing the public schema.
- Any validation errors in schemas should be surfaced when saving an endpoint.

## Developer notes
- When tweaking the endpoint schema model, update both the generation logic and the docs.
- Keep the generation logic in one place to avoid drift.
