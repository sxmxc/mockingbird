# Domain Model

## EndpointDefinition
Represents a managed mock API endpoint.

Fields:
- `id`: UUID
- `name`: human-friendly label
- `slug`: machine-friendly identifier (used in admin UI)
- `method`: HTTP method (GET, POST, etc.)
- `path`: URI path (e.g., `/api/quotes`)
- `category`: grouping (e.g., `quotes`, `users`)
- `tags`: list of tags
- `summary` / `description`: OpenAPI description fields
- `enabled`: boolean
- `auth_mode`: none/basic/api_key/bearer
- `request_schema`: JSON Schema for request body / parameters
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
- `mocking`: type-correct values with a more playful Mockingbird tone, such as snarkier text, themed emails, cheekier names, or longer quote/message copy.
- `fixed`: static literal JSON returned exactly as configured.

## OpenAPI model
The OpenAPI schema is generated dynamically by mapping `EndpointDefinition` fields to OpenAPI path entries.
- `request_schema` becomes `requestBody` for `POST` / `PUT` / `PATCH`.
- `response_schema` becomes response schema after stripping `x-mock` and `x-builder`.
- `summary` and `description` are used in the OpenAPI operation.
