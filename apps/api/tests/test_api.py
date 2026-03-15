import json
import os
import sys
import tempfile
from base64 import b64encode
from pathlib import Path
from uuid import UUID

from sqlalchemy import create_engine, inspect, select, text

# Ensure the backend package is importable when running tests.
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

TEST_DB_PATH = Path(tempfile.gettempdir()) / "mockingbird-test.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()
os.environ.setdefault("DATABASE_URL", f"sqlite:///{TEST_DB_PATH}")

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

import app.db as db_module
from app.db import create_db_and_tables, engine
from app.main import app
from app.models import EndpointDefinition
from scripts.seed import DEVICE_MODELS


def _reset_db() -> None:
    engine.dispose()
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()
    create_db_and_tables()


def _basic_auth_headers(username: str = "admin", password: str = "admin123") -> dict[str, str]:
    token = b64encode(f"{username}:{password}".encode("utf-8")).decode("utf-8")
    return {"Authorization": f"Basic {token}"}


@pytest.fixture
def seeded_db():
    _reset_db()
    from scripts.seed import seed

    seed()
    yield


@pytest.fixture
def empty_db():
    _reset_db()
    yield


def test_create_db_and_tables_uses_alembic_schema():
    _reset_db()
    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("endpointdefinition")}
    assert "response_schema" in columns
    assert "seed_key" in columns
    assert "example_template" not in columns
    assert "response_mode" not in columns


def test_openapi_endpoint(seeded_db):
    client = TestClient(app)
    response = client.get("/openapi.json")
    assert response.status_code == 200


def test_public_landing_reference_and_brand_asset(seeded_db):
    client = TestClient(app)

    landing = client.get("/")
    assert landing.status_code == 200
    assert "Mockingbird" in landing.text
    assert "Mock APIs with a little" in landing.text
    assert "hero-title-accent" in landing.text
    assert "hero-panel-bottom" in landing.text
    assert "hero-panel-media" in landing.text
    assert "/static/landing/hero-top.svg" in landing.text
    assert "/static/landing/hero-bottom.svg" in landing.text
    assert "/api/reference.json" in landing.text
    assert "reference-table-body" in landing.text
    assert "payload-popover" in landing.text
    assert "modal-card-head-content" in landing.text
    assert "theme-toggle" in landing.text
    assert "bulma@1.0.4" in landing.text
    assert "status-success" in landing.text

    api_landing = client.get("/api")
    assert api_landing.status_code == 200
    assert "Everything currently live." in api_landing.text

    reference = client.get("/api/reference.json")
    assert reference.status_code == 200
    payload = reference.json()
    assert payload["product_name"] == "Mockingbird"
    assert payload["endpoint_count"] >= 1
    assert payload["endpoints"][0]["sample_response"] is not None

    asset = client.get("/static/mockingbird-icon.svg")
    assert asset.status_code == 200
    assert asset.headers["content-type"].startswith("image/svg+xml")


def test_admin_endpoints_require_basic_auth(empty_db):
    client = TestClient(app)
    response = client.get("/api/admin/endpoints")
    assert response.status_code == 401


def test_get_session_dependency_closes_session_context():
    events: list[tuple[str, object | None]] = []

    class FakeSession:
        def __init__(self, bound_engine):
            events.append(("init", bound_engine))

        def __enter__(self):
            events.append(("enter", None))
            return self

        def __exit__(self, exc_type, exc, tb):
            events.append(("exit", exc_type))

    original_session = db_module.Session
    db_module.Session = FakeSession
    try:
        dependency = db_module.get_session()
        session = next(dependency)

        assert isinstance(session, FakeSession)
        assert [event[0] for event in events] == ["init", "enter"]

        with pytest.raises(StopIteration):
            next(dependency)

        assert [event[0] for event in events] == ["init", "enter", "exit"]
    finally:
        db_module.Session = original_session


def test_admin_crud_lifecycle_supports_builder_extensions(empty_db):
    client = TestClient(app)
    headers = _basic_auth_headers()
    payload = {
        "name": "List Gadgets",
        "slug": "list-gadgets",
        "method": "GET",
        "path": "/api/gadgets",
        "category": "gadgets",
        "tags": ["gadgets", "inventory"],
        "summary": "List gadgets",
        "description": "Returns the current gadget catalog.",
        "enabled": True,
        "auth_mode": "none",
        "request_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer"},
            },
            "required": [],
            "x-builder": {"order": ["limit"]},
        },
        "response_schema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "format": "uuid",
                    "x-mock": {"mode": "generate", "type": "id", "options": {}},
                },
                "status": {
                    "type": "string",
                    "enum": ["ok", "queued"],
                    "x-mock": {"mode": "generate", "type": "enum", "options": {}},
                },
            },
            "required": ["id", "status"],
            "x-builder": {"order": ["id", "status"]},
            "x-mock": {"mode": "generate"},
        },
        "success_status_code": 200,
        "error_rate": 0.0,
        "latency_min_ms": 0,
        "latency_max_ms": 0,
        "seed_key": "gadgets",
    }

    create_response = client.post("/api/admin/endpoints", json=payload, headers=headers)
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["response_schema"]["properties"]["id"]["x-mock"]["type"] == "id"
    assert "example_template" not in created
    assert "response_mode" not in created

    read_response = client.get(f"/api/admin/endpoints/{created['id']}", headers=headers)
    assert read_response.status_code == 200

    update_response = client.put(
        f"/api/admin/endpoints/{created['id']}",
        json={
            "enabled": False,
            "response_schema": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "x-mock": {"mode": "fixed", "value": "offline", "options": {}},
                    }
                },
                "required": ["status"],
                "x-builder": {"order": ["status"]},
                "x-mock": {"mode": "generate"},
            },
        },
        headers=headers,
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["enabled"] is False
    assert updated["response_schema"]["properties"]["status"]["x-mock"]["mode"] == "fixed"

    delete_response = client.delete(f"/api/admin/endpoints/{created['id']}", headers=headers)
    assert delete_response.status_code == 204

    missing_response = client.get(f"/api/admin/endpoints/{created['id']}", headers=headers)
    assert missing_response.status_code == 404


def test_preview_endpoint_is_seeded_and_type_correct(empty_db):
    client = TestClient(app)
    headers = _basic_auth_headers()
    response_schema = {
        "type": "object",
        "properties": {
            "id": {"type": "string", "x-mock": {"mode": "generate", "type": "id", "options": {}}},
            "email": {"type": "string", "x-mock": {"mode": "generate", "type": "email", "options": {}}},
            "firstName": {"type": "string", "x-mock": {"mode": "generate", "type": "first_name", "options": {}}},
            "displayName": {"type": "string", "x-mock": {"mode": "generate", "type": "name", "options": {}}},
            "quote": {
                "type": "string",
                "x-mock": {"mode": "mocking", "type": "long_text", "options": {}},
            },
            "status": {
                "type": "string",
                "enum": ["ok", "queued"],
                "x-mock": {"mode": "generate", "type": "enum", "options": {}},
            },
            "teaser": {
                "type": "string",
                "x-mock": {"mode": "mocking", "type": "text", "options": {"sentences": 1}},
            },
            "contact": {
                "type": "string",
                "x-mock": {"mode": "mocking", "type": "email", "options": {}},
            },
            "price": {
                "type": "number",
                "minimum": 10,
                "maximum": 500,
                "x-mock": {"mode": "mocking", "type": "price", "options": {"precision": 2}},
            },
            "details": {
                "type": "object",
                "x-mock": {"mode": "fixed", "value": {"source": "preview"}, "options": {}},
                "properties": {
                    "source": {"type": "string"},
                },
                "required": ["source"],
                "x-builder": {"order": ["source"]},
            },
        },
        "required": ["id", "email", "firstName", "displayName", "quote", "status", "teaser", "contact", "price", "details"],
        "x-builder": {"order": ["id", "email", "firstName", "displayName", "quote", "status", "teaser", "contact", "price", "details"]},
        "x-mock": {"mode": "generate"},
    }

    first = client.post(
        "/api/admin/endpoints/preview-response",
        json={"response_schema": response_schema, "seed_key": "stable-seed"},
        headers=headers,
    )
    second = client.post(
        "/api/admin/endpoints/preview-response",
        json={"response_schema": response_schema, "seed_key": "stable-seed"},
        headers=headers,
    )
    third = client.post(
        "/api/admin/endpoints/preview-response",
        json={"response_schema": response_schema, "seed_key": None},
        headers=headers,
    )
    fourth = client.post(
        "/api/admin/endpoints/preview-response",
        json={"response_schema": response_schema, "seed_key": None},
        headers=headers,
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 200
    assert fourth.status_code == 200

    first_preview = first.json()["preview"]
    assert first_preview == second.json()["preview"]
    UUID(first_preview["id"])
    assert first_preview["details"] == {"source": "preview"}
    assert first_preview["status"] in {"ok", "queued"}
    assert isinstance(first_preview["firstName"], str) and first_preview["firstName"]
    assert isinstance(first_preview["displayName"], str) and " " in first_preview["displayName"]
    assert isinstance(first_preview["quote"], str) and len(first_preview["quote"]) > 64
    assert first_preview["contact"].endswith("@mockingbird.test")
    assert any(token in first_preview["teaser"].lower() for token in {"mock", "payload", "qa", "response", "frontend"})
    assert isinstance(first_preview["price"], float)
    assert first_preview != fourth.json()["preview"] or third.json()["preview"] != fourth.json()["preview"]


def test_preview_endpoint_upgrades_legacy_text_quotes_to_long_text(empty_db):
    client = TestClient(app)
    headers = _basic_auth_headers()
    response_schema = {
        "type": "object",
        "properties": {
            "quote": {
                "type": "string",
                "x-mock": {"mode": "mocking", "type": "text", "options": {"sentences": 2}},
            },
        },
        "required": ["quote"],
        "x-builder": {"order": ["quote"]},
        "x-mock": {"mode": "generate"},
    }

    response = client.post(
        "/api/admin/endpoints/preview-response",
        json={"response_schema": response_schema, "seed_key": "stable-seed"},
        headers=headers,
    )

    assert response.status_code == 200
    preview = response.json()["preview"]
    assert isinstance(preview["quote"], str)
    assert len(preview["quote"]) > 64


def test_runtime_dispatch_matches_seeded_endpoints(seeded_db):
    client = TestClient(app)

    list_response = client.get("/api/quotes")
    assert list_response.status_code == 200
    quotes = list_response.json()
    assert isinstance(quotes, list)
    assert len(quotes) >= 2
    assert {"id", "quote", "author"} <= set(quotes[0].keys())

    detail_response = client.get("/api/users/example-user")
    assert detail_response.status_code == 200
    user = detail_response.json()
    assert {"id", "displayName", "email", "role"} <= set(user.keys())

    create_response = client.post("/api/users", json={"displayName": "Alex", "email": "alex@example.mock"})
    assert create_response.status_code == 201
    created_user = create_response.json()
    assert {"id", "displayName", "email", "createdAt"} <= set(created_user.keys())

    devices_response = client.get("/api/devices")
    assert devices_response.status_code == 200
    devices = devices_response.json()
    assert isinstance(devices, list)
    assert len(devices) >= 2
    assert {"deviceId", "model", "status"} <= set(devices[0].keys())
    UUID(devices[0]["deviceId"])

    device_detail_response = client.get("/api/devices/example-device")
    assert device_detail_response.status_code == 200
    device = device_detail_response.json()
    assert {"deviceId", "model", "status", "lastSeen"} <= set(device.keys())
    UUID(device["deviceId"])

    health_response = client.get("/api/health")
    assert health_response.status_code == 200
    assert health_response.json() == {"status": "ok"}


def test_seeded_device_schemas_use_curated_model_enum_defaults(seeded_db):
    with Session(engine) as session:
        endpoints = {
            endpoint.slug: endpoint
            for endpoint in session.execute(
                select(EndpointDefinition).where(EndpointDefinition.slug.in_(["list-devices", "get-device"]))
            )
            .scalars()
            .all()
        }

    list_devices_model_schema = endpoints["list-devices"].response_schema["items"]["properties"]["model"]
    get_device_model_schema = endpoints["get-device"].response_schema["properties"]["model"]
    list_devices_id_schema = endpoints["list-devices"].response_schema["items"]["properties"]["deviceId"]
    get_device_id_schema = endpoints["get-device"].response_schema["properties"]["deviceId"]

    assert list_devices_model_schema["enum"] == DEVICE_MODELS
    assert get_device_model_schema["enum"] == DEVICE_MODELS
    assert list_devices_id_schema["format"] == "uuid"
    assert get_device_id_schema["format"] == "uuid"
    assert list_devices_id_schema["x-mock"]["type"] == "id"
    assert get_device_id_schema["x-mock"]["type"] == "id"


def test_runtime_dispatch_ignores_disabled_endpoints(empty_db):
    client = TestClient(app)
    headers = _basic_auth_headers()

    create_response = client.post(
        "/api/admin/endpoints",
        json={
            "name": "Disabled Endpoint",
            "slug": "disabled-endpoint",
            "method": "GET",
            "path": "/api/disabled",
            "category": "testing",
            "tags": [],
            "summary": "Disabled endpoint",
            "description": "Should not be publicly reachable.",
            "enabled": False,
            "auth_mode": "none",
            "request_schema": {},
            "response_schema": {
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "x-mock": {"mode": "fixed", "value": "You should not see this.", "options": {}},
                    }
                },
                "required": ["message"],
                "x-builder": {"order": ["message"]},
                "x-mock": {"mode": "generate"},
            },
            "success_status_code": 200,
            "error_rate": 0.0,
            "latency_min_ms": 0,
            "latency_max_ms": 0,
            "seed_key": None,
        },
        headers=headers,
    )
    assert create_response.status_code == 201

    response = client.get("/api/disabled")
    assert response.status_code == 404


def test_openapi_strips_internal_extensions_and_emits_request_body(seeded_db):
    client = TestClient(app)
    response = client.get("/openapi.json")
    assert response.status_code == 200

    openapi = response.json()
    create_user = openapi["paths"]["/api/users"]["post"]
    assert "requestBody" in create_user

    response_schema = create_user["responses"]["201"]["content"]["application/json"]["schema"]
    assert "x-mock" not in response_schema
    assert "x-builder" not in response_schema
    assert "x-mock" not in response_schema["properties"]["id"]


def test_legacy_rows_migrate_to_unified_response_schema():
    engine.dispose()
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()

    legacy_engine = create_engine(f"sqlite:///{TEST_DB_PATH}")
    with legacy_engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE endpointdefinition (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    slug VARCHAR NOT NULL,
                    method VARCHAR NOT NULL,
                    path VARCHAR NOT NULL,
                    category VARCHAR,
                    tags JSON,
                    summary VARCHAR,
                    description VARCHAR,
                    enabled BOOLEAN NOT NULL,
                    auth_mode VARCHAR NOT NULL,
                    request_schema JSON,
                    response_schema JSON,
                    example_template JSON,
                    response_mode VARCHAR NOT NULL,
                    success_status_code INTEGER NOT NULL,
                    error_rate FLOAT NOT NULL,
                    latency_min_ms INTEGER NOT NULL,
                    latency_max_ms INTEGER NOT NULL,
                    seed_key VARCHAR,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO endpointdefinition (
                    id, name, slug, method, path, category, tags, summary, description, enabled, auth_mode,
                    request_schema, response_schema, example_template, response_mode, success_status_code,
                    error_rate, latency_min_ms, latency_max_ms, seed_key, created_at, updated_at
                ) VALUES (
                    1, 'Legacy Endpoint', 'legacy-endpoint', 'GET', '/api/legacy', 'legacy', :tags, 'Legacy',
                    'Migrated from old contract', 1, 'none', :request_schema, :response_schema, :example_template,
                    'fixed', 200, 0, 0, 0, NULL, '2026-03-14 00:00:00', '2026-03-14 00:00:00'
                )
                """
            ),
            {
                "tags": json.dumps(["legacy"]),
                "request_schema": json.dumps({}),
                "response_schema": json.dumps(
                    {
                        "type": "object",
                        "properties": {"message": {"type": "string"}},
                    }
                ),
                "example_template": json.dumps({"message": "Legacy hello"}),
            },
        )

    create_db_and_tables()

    with Session(engine) as session:
        endpoint = session.execute(select(EndpointDefinition)).scalars().one()
        assert endpoint.response_schema["x-mock"]["mode"] == "fixed"
        assert endpoint.response_schema["x-mock"]["value"] == {"message": "Legacy hello"}
        assert endpoint.request_schema == {}
