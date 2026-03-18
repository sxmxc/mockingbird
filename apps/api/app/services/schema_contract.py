from __future__ import annotations

from copy import deepcopy
import re
from typing import Any


DEFAULT_ROOT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {},
    "required": [],
    "x-builder": {"order": []},
}
REQUEST_PARAMETERS_KEY = "x-request"
REQUEST_PARAMETER_LOCATIONS = ("path", "query")
MOCK_VALUE_TYPE_ALIASES = {
    "uuid": "id",
    "guid": "id",
    "full_name": "name",
    "fullname": "name",
    "float": "number",
    "longtext": "long_text",
    "keyboard": "keyboard_key",
    "keycap": "keyboard_key",
    "hotkey": "keyboard_key",
    "filename": "file_name",
    "mime": "mime_type",
    "contenttype": "mime_type",
    "mediatype": "mime_type",
    "systemverb": "verb",
}
STRING_FORMAT_BY_VALUE_TYPE = {
    "id": "uuid",
    "email": "email",
    "url": "uri",
    "date": "date",
    "datetime": "date-time",
    "time": "time",
}
TEMPLATE_EXPRESSION_PATTERN = re.compile(r"\{\{\s*([^{}]+?)\s*\}\}")
TEMPLATE_REQUEST_LOCATIONS = {"path", "query", "body"}


def default_response_root() -> dict[str, Any]:
    root = deepcopy(DEFAULT_ROOT_SCHEMA)
    root["x-mock"] = {"mode": "generate"}
    return root


def _normalize_mock_mode(raw_mode: Any) -> str:
    normalized = str(raw_mode or "generate").lower()
    return normalized if normalized in {"generate", "fixed", "mocking"} else "generate"


def normalize_mock_value_type(raw_value_type: Any) -> str | None:
    normalized = str(raw_value_type or "").strip().lower()
    if not normalized:
        return None
    return MOCK_VALUE_TYPE_ALIASES.get(normalized, normalized)


def _normalize_mock_template(mock_config: dict[str, Any]) -> None:
    template = mock_config.get("template")
    if template is None:
        mock_config.pop("template", None)
        return

    if isinstance(template, str):
        stripped = template.strip()
        if stripped:
            mock_config["template"] = stripped
            return
        mock_config.pop("template", None)


def default_request_root() -> dict[str, Any]:
    return deepcopy(DEFAULT_ROOT_SCHEMA)


def default_request_parameter_root() -> dict[str, Any]:
    return deepcopy(DEFAULT_ROOT_SCHEMA)


def sanitize_public_schema(schema: Any) -> Any:
    if isinstance(schema, list):
        return [sanitize_public_schema(item) for item in schema]

    if not isinstance(schema, dict):
        return schema

    sanitized: dict[str, Any] = {}
    for key, value in schema.items():
        if key in {"x-mock", "x-builder", REQUEST_PARAMETERS_KEY}:
            continue
        sanitized[key] = sanitize_public_schema(value)
    return sanitized


def request_path_parameter_names(path: str) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    cursor = 0

    while True:
        start = path.find("{", cursor)
        if start == -1:
            return names

        end = path.find("}", start + 1)
        if end == -1:
            return names

        name = path[start + 1:end].strip()
        cursor = end + 1
        if not name or name in seen:
            continue

        seen.add(name)
        names.append(name)


def _normalize_parameter_property_schema(schema: Any, *, property_name: str) -> dict[str, Any]:
    normalized = normalize_schema_for_builder(schema or {"type": "string"}, property_name=property_name, include_mock=False)
    if normalized.get("type") in {"object", "array"} or "properties" in normalized or "items" in normalized:
        return normalize_schema_for_builder({"type": "string"}, property_name=property_name, include_mock=False)
    return normalized


def normalize_request_parameter_schema(schema: Any) -> dict[str, Any]:
    if not isinstance(schema, dict) or not schema:
        return default_request_parameter_root()

    normalized = normalize_schema_for_builder(schema, property_name="root", include_mock=False)
    if normalized.get("type") != "object":
        return default_request_parameter_root()

    properties = normalized.get("properties", {}) or {}
    required = [value for value in normalized.get("required", []) if value in properties]
    order = [value for value in normalized.get("x-builder", {}).get("order", []) if value in properties]

    for key in properties:
        if key not in order:
            order.append(key)

    normalized["properties"] = {
        key: _normalize_parameter_property_schema(properties[key], property_name=key)
        for key in order
    }
    normalized["required"] = required
    normalized["x-builder"] = {"order": order}
    return normalized


def sync_request_path_parameter_schema(path: str, schema: Any) -> dict[str, Any]:
    parameter_names = request_path_parameter_names(path)
    normalized = normalize_request_parameter_schema(schema)
    properties = normalized.get("properties", {}) or {}

    normalized["type"] = "object"
    normalized["properties"] = {
        name: _normalize_parameter_property_schema(properties.get(name), property_name=name)
        for name in parameter_names
    }
    normalized["required"] = list(parameter_names)
    normalized["x-builder"] = {"order": list(parameter_names)}
    return normalized


def extract_request_parameter_schemas(schema: Any) -> dict[str, dict[str, Any]]:
    raw_extension = schema.get(REQUEST_PARAMETERS_KEY) if isinstance(schema, dict) else {}
    extension = raw_extension if isinstance(raw_extension, dict) else {}
    return {
        location: normalize_request_parameter_schema(extension.get(location))
        for location in REQUEST_PARAMETER_LOCATIONS
    }


def extract_request_body_schema(schema: Any) -> dict[str, Any]:
    if not isinstance(schema, dict) or not schema:
        return default_request_root()

    body_schema = deepcopy(schema)
    body_schema.pop(REQUEST_PARAMETERS_KEY, None)
    if not body_schema:
        return default_request_root()

    return normalize_schema_for_builder(body_schema, property_name="root", include_mock=False)


def _has_request_parameter_fields(schema: dict[str, Any]) -> bool:
    return bool(schema.get("properties"))


def build_request_schema_contract(
    schema: Any,
    *,
    path_schema: Any | None = None,
    query_schema: Any | None = None,
) -> dict[str, Any]:
    body_schema = extract_request_body_schema(schema)
    existing_parameters = extract_request_parameter_schemas(schema)
    normalized_path = normalize_request_parameter_schema(existing_parameters["path"] if path_schema is None else path_schema)
    normalized_query = normalize_request_parameter_schema(existing_parameters["query"] if query_schema is None else query_schema)

    parameters: dict[str, Any] = {}
    if _has_request_parameter_fields(normalized_path):
        parameters["path"] = normalized_path
    if _has_request_parameter_fields(normalized_query):
        parameters["query"] = normalized_query

    if parameters:
        body_schema[REQUEST_PARAMETERS_KEY] = parameters

    return body_schema


def normalize_request_schema_contract(schema: Any, *, path: str | None = None) -> dict[str, Any]:
    parameters = extract_request_parameter_schemas(schema)
    if path is not None:
        parameters["path"] = sync_request_path_parameter_schema(path, parameters["path"])
    return build_request_schema_contract(
        schema,
        path_schema=parameters["path"],
        query_schema=parameters["query"],
    )


def infer_schema_from_value(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        properties = {key: infer_schema_from_value(child) for key, child in value.items()}
        return {
            "type": "object",
            "properties": properties,
            "required": list(value.keys()),
            "x-builder": {"order": list(value.keys())},
        }

    if isinstance(value, list):
        item_schema = infer_schema_from_value(value[0]) if value else {"type": "string"}
        return {
            "type": "array",
            "items": item_schema,
            "minItems": len(value),
            "maxItems": len(value),
        }

    if isinstance(value, bool):
        return {"type": "boolean"}

    if isinstance(value, int) and not isinstance(value, bool):
        return {"type": "integer"}

    if isinstance(value, float):
        return {"type": "number"}

    if value is None:
        return {"type": "string"}

    return {"type": "string"}


def guess_mock_value_type(property_name: str, schema: dict[str, Any]) -> str | None:
    normalized_name = property_name.replace("-", "_").lower()
    schema_format = str(schema.get("format", "")).lower()
    schema_type = str(schema.get("type", "")).lower()

    if schema.get("enum"):
        return "enum"

    if schema_format == "email" or "email" in normalized_name:
        return "email"
    if schema_format in {"uri", "url"}:
        return "url"
    if schema_format == "uuid" or normalized_name in {"id", "uuid"} or normalized_name.endswith("_id"):
        return "id"
    if normalized_name in {"username", "user_name", "handle"}:
        return "username"
    if "password" in normalized_name:
        return "password"
    if normalized_name in {"keyboard_key", "keyboardkey", "shortcut", "shortcut_key", "shortcutkey", "hotkey", "key_name", "keyname", "keycap"}:
        return "keyboard_key"
    if normalized_name in {"verb", "action", "command", "operation", "job_action", "jobaction", "system_action", "systemaction"}:
        return "verb"
    if normalized_name in {"file_name", "filename", "document_name", "documentname", "attachment_name", "attachmentname"}:
        return "file_name"
    if normalized_name in {"mime_type", "mimetype", "content_type", "contenttype", "media_type", "mediatype"}:
        return "mime_type"
    if schema_format == "date":
        return "date"
    if schema_format == "date-time":
        return "datetime"
    if schema_format == "time":
        return "time"
    if "slug" in normalized_name:
        return "slug"
    if normalized_name in {"firstname", "first_name", "given_name"}:
        return "first_name"
    if normalized_name in {"lastname", "last_name", "surname"}:
        return "last_name"
    if normalized_name in {"name", "displayname", "display_name", "full_name", "fullname"}:
        return "name"
    if "company" in normalized_name or "organization" in normalized_name:
        return "company"
    if "phone" in normalized_name:
        return "phone"
    if "street" in normalized_name or "address" in normalized_name:
        return "street_address"
    if "city" in normalized_name:
        return "city"
    if "state" in normalized_name or "province" in normalized_name:
        return "state"
    if "country" in normalized_name:
        return "country"
    if "zip" in normalized_name or "postal" in normalized_name:
        return "postal_code"
    if "avatar" in normalized_name or "image" in normalized_name:
        return "avatar_url"
    if "price" in normalized_name or "amount" in normalized_name or "total" in normalized_name:
        return "price"
    if (
        "message" in normalized_name
        or "quote" in normalized_name
        or "details" in normalized_name
        or "description" in normalized_name
        or "content" in normalized_name
        or normalized_name == "body"
    ):
        return "long_text"
    if schema_type == "integer":
        return "integer"
    if schema_type == "number":
        return "number"
    if schema_type == "boolean":
        return "boolean"
    if schema_type == "string":
        return "text"

    return None


def _normalize_object_schema(schema: dict[str, Any], *, include_mock: bool) -> dict[str, Any]:
    properties = schema.get("properties", {})
    property_order = list(schema.get("x-builder", {}).get("order", []) or [])

    for key in properties.keys():
        if key not in property_order:
            property_order.append(key)

    normalized = dict(schema)
    normalized["type"] = "object"
    normalized["properties"] = {
        key: normalize_schema_for_builder(child, property_name=key, include_mock=include_mock)
        for key, child in properties.items()
    }
    normalized["required"] = list(schema.get("required", []))
    normalized["x-builder"] = {"order": property_order}

    if include_mock:
        normalized["x-mock"] = dict(schema.get("x-mock", {}) or {"mode": "generate"})
        normalized["x-mock"]["mode"] = _normalize_mock_mode(normalized["x-mock"].get("mode"))
        _normalize_mock_template(normalized["x-mock"])

    return normalized


def _normalize_array_schema(schema: dict[str, Any], *, property_name: str, include_mock: bool) -> dict[str, Any]:
    normalized = dict(schema)
    normalized["type"] = "array"
    normalized["items"] = normalize_schema_for_builder(
        schema.get("items") or {"type": "string"},
        property_name=property_name,
        include_mock=include_mock,
    )

    if include_mock:
        normalized["x-mock"] = dict(schema.get("x-mock", {}) or {"mode": "generate"})
        normalized["x-mock"]["mode"] = _normalize_mock_mode(normalized["x-mock"].get("mode"))
        _normalize_mock_template(normalized["x-mock"])

    return normalized


def normalize_schema_for_builder(
    schema: Any,
    *,
    property_name: str = "value",
    include_mock: bool,
) -> dict[str, Any]:
    if not isinstance(schema, dict) or not schema:
        return default_response_root() if include_mock and property_name == "root" else default_request_root()

    schema_type = schema.get("type")

    if schema_type == "object" or "properties" in schema:
        return _normalize_object_schema(schema, include_mock=include_mock)

    if schema_type == "array" or "items" in schema:
        return _normalize_array_schema(schema, property_name=property_name, include_mock=include_mock)

    normalized = dict(schema)
    if include_mock:
        mock_config = dict(schema.get("x-mock", {}) or {})
        mock_config["mode"] = _normalize_mock_mode(mock_config.get("mode"))
        mock_value_type = normalize_mock_value_type(mock_config.get("type") or mock_config.get("generator"))
        guessed_value_type = guess_mock_value_type(property_name, normalized)
        resolved_value_type = (
            guessed_value_type
            if mock_value_type == "text" and guessed_value_type == "long_text"
            else mock_value_type or guessed_value_type
        )
        if mock_config["mode"] in {"generate", "mocking"}:
            if resolved_value_type:
                mock_config["type"] = resolved_value_type
                # Keep the legacy alias populated so older records and tests still round-trip cleanly.
                mock_config["generator"] = resolved_value_type
            mock_config.setdefault("options", {})
        _normalize_mock_template(mock_config)
        normalized["x-mock"] = mock_config
        if normalized.get("type") == "string" and "format" not in normalized and resolved_value_type in STRING_FORMAT_BY_VALUE_TYPE:
            normalized["format"] = STRING_FORMAT_BY_VALUE_TYPE[resolved_value_type]
    return normalized


def _extract_template_tokens(template: str) -> list[str]:
    tokens = [match.group(1).strip() for match in TEMPLATE_EXPRESSION_PATTERN.finditer(template)]
    remainder = TEMPLATE_EXPRESSION_PATTERN.sub("", template)
    if "{{" in remainder or "}}" in remainder:
        raise ValueError("Response templates must use balanced {{token}} placeholders.")
    return tokens


def _validate_template_token(token: str, *, path_parameter_names: set[str] | None) -> None:
    if token == "value":
        return

    parts = [segment.strip() for segment in token.split(".")]
    if len(parts) < 3 or parts[0] != "request" or parts[1] not in TEMPLATE_REQUEST_LOCATIONS or any(not segment for segment in parts[2:]):
        raise ValueError(
            f"Unsupported response template token '{token}'. Use {{value}}, {{request.path.*}}, {{request.query.*}}, or {{request.body.*}}."
        )

    if parts[1] == "path" and path_parameter_names is not None and parts[2] not in path_parameter_names:
        raise ValueError(f"Response template references unknown path parameter '{parts[2]}'.")


def validate_response_templates(schema: Any, *, path: str | None = None) -> None:
    path_parameter_names = set(request_path_parameter_names(path)) if path else None

    def walk(node: Any) -> None:
        if not isinstance(node, dict):
            return

        mock_config = node.get("x-mock", {}) if isinstance(node.get("x-mock"), dict) else {}
        template = mock_config.get("template")
        if template is not None:
            if not isinstance(template, str):
                raise ValueError("Response templates must be strings.")
            if str(node.get("type", "")).lower() != "string":
                raise ValueError("Response templates are only supported on string fields.")
            for token in _extract_template_tokens(template):
                _validate_template_token(token, path_parameter_names=path_parameter_names)

        if node.get("type") == "object" or "properties" in node:
            for child in (node.get("properties", {}) or {}).values():
                walk(child)

        if node.get("type") == "array" or "items" in node:
            walk(node.get("items"))

    walk(schema)


def build_fixed_schema_from_example(value: Any) -> dict[str, Any]:
    inferred = infer_schema_from_value(value)
    normalized = normalize_schema_for_builder(inferred, property_name="root", include_mock=True)
    normalized["x-mock"] = {
        "mode": "fixed",
        "value": value,
        "options": {},
    }
    return normalized


def migrate_legacy_response_schema(
    response_schema: Any,
    example_template: Any,
    response_mode: str | None,
) -> dict[str, Any]:
    normalized_mode = (response_mode or "random").lower()
    has_schema = isinstance(response_schema, dict) and bool(response_schema)

    if normalized_mode in {"fixed", "template"} and example_template is not None:
        return build_fixed_schema_from_example(example_template)

    if has_schema:
        return normalize_schema_for_builder(response_schema, property_name="root", include_mock=True)

    if example_template is not None:
        if normalized_mode == "random":
            inferred = infer_schema_from_value(example_template)
            return normalize_schema_for_builder(inferred, property_name="root", include_mock=True)
        return build_fixed_schema_from_example(example_template)

    return default_response_root()
