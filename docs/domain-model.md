# Domain Model

## EndpointDefinition
Represents a managed mock API endpoint.

Fields:
- `id`: UUID
- `name`: human-friendly label
- `slug`: machine-friendly internal identifier used for seed/import/admin bookkeeping, auto-generated from the route name for admin-created routes
- `method`: HTTP method (GET, POST, etc.)
- `path`: URI path (e.g., `/api/quotes`)
- `category`: grouping (e.g., `quotes`, `users`)
- `tags`: list of tags
- `summary` / `description`: OpenAPI description fields
- `enabled`: boolean
- `auth_mode`: none/basic/api_key/bearer
- `request_schema`: JSON Schema request contract; the body schema lives at the root, while optional path/query parameter metadata lives under `x-request`
- `response_schema`: JSON Schema for response body plus internal builder/generator extensions
- `success_status_code`: HTTP status for successful responses
- `error_rate`: ratio of requests that return an error
- `latency_min_ms`, `latency_max_ms`: for simulated delay
- `seed_key`: deterministic seed for repeatable random output
- `created_at`, `updated_at`: audit timestamps

## Response generation
The system now generates mock responses directly from `response_schema`.

Supported internal schema extensions:
- `x-mock.mode`: `generate`, `mocking`, or `fixed`
- `x-mock.type`: optional semantic value type such as `id`, `email`, `name`, `first_name`, `price`, or `long_text`
- `x-mock.generator`: legacy alias for `x-mock.type`, still accepted for compatibility
- `x-mock.options`: generator-specific settings
- `x-mock.value`: literal JSON subtree returned when the node is fixed
- `x-builder.order`: object property order used by the drag-and-drop builder

Random generation respects standard JSON Schema keywords where useful:
- `enum`
- `format`
- `minimum` / `maximum`
- `minLength` / `maxLength`
- `minItems` / `maxItems`

For string identifiers, `format: uuid` is treated as the semantic `id` value type during normalization and sample generation.

Mode behavior:
- `generate`: type-correct true random values.
- `mocking`: type-correct values with a sharper Mockingbird tone, such as snarkier text, cheekier slugs/emails, sardonic company names, or longer quote/message copy that can gently roast the consumer.
- `fixed`: static literal JSON returned exactly as configured.

## Request contract
`request_schema` now carries both request-body and request-parameter authoring state.
- The root object is the JSON Schema used for the request body on `POST` / `PUT` / `PATCH` routes.
- Optional `request_schema["x-request"]["path"]` and `request_schema["x-request"]["query"]` sections store flat object schemas for path and query parameters.
- Path parameter names are derived from the saved route path (for example `/api/devices/{deviceId}`) and are automatically kept required/in-order to match the live route template.
- If a route placeholder exists before explicit path-parameter metadata is authored, OpenAPI still publishes that parameter as a required `string` path input by default.
- Query parameters use the same object-schema shape, with `required` and `x-builder.order` preserving UI state.
- Parameter authoring is intentionally limited to flat scalar/enum fields today; nested parameter objects, arrays, and advanced serialization styles are not modeled yet.

## Catalog bundle
The admin import/export flow uses a native Mockingbird JSON bundle for backup and environment sync.
- Top-level bundle fields are `schema_version`, `product`, `exported_at`, and `endpoints`.
- Each bundled endpoint stores the editable route contract, including request/response schemas and runtime simulation settings, but excludes DB-only fields such as `id`, `created_at`, and `updated_at`.
- V1 imports match existing routes by normalized `method + path`; `slug` remains an internal field that can be de-duplicated during import.
- Supported import modes are `create_only`, `upsert`, and `replace_all`, with dry-run previews available before any changes are applied.

## OpenAPI model
The OpenAPI schema is generated dynamically by mapping `EndpointDefinition` fields to OpenAPI path entries.
- The root `request_schema` body becomes `requestBody` for `POST` / `PUT` / `PATCH` after stripping internal request-parameter metadata.
- `request_schema["x-request"]["path"]` and `request_schema["x-request"]["query"]` become OpenAPI `parameters`.
- `response_schema` becomes response schema after stripping `x-mock` and `x-builder`.
- `summary` and `description` are used in the OpenAPI operation.

## Public reference feed
The public `/api/reference.json` feed exposes sanitized endpoint metadata for the landing page quick reference.
- `request_schema` and `response_schema` are stripped of internal `x-mock`, `x-builder`, and `x-request` keys before publishing.
- `sample_response` is generated from `response_schema`.
- `sample_request` is generated from the root request-body schema for `POST` / `PUT` / `PATCH` routes so the public examples modal can show the JSON body to send alongside the mock response.
