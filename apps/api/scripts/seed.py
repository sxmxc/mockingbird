from __future__ import annotations

from sqlalchemy import select
from sqlmodel import Session

from app.crud import create_endpoint
from app.db import session_scope
from app.models import EndpointDefinition
from app.schemas import EndpointCreate
from app.services.schema_contract import build_fixed_schema_from_example, normalize_schema_for_builder


DEVICE_MODELS = [
    "PacketStorm PX-4200",
    "TurboCore TX-900",
    "QuantumBridge QB-88",
    "SignalForge SF-1200",
    "HyperNode HN-640",
    "DataPulse DP-3000",
    "VectorGrid VG-72",
    "CoreMatrix CM-810",
    "PhotonLink PL-404",
    "MegaFabric MF-1600",
    "NanoSwitch NS-88X",
    "OmniRouter OR-550",
    "PulseArray PA-2048",
    "TurboLatch TL-900X",
    "QuantumPort QP-77",
    "HyperDrive HD-990",
    "FluxRouter FR-2200",
    "CorePulse CP-480",
    "SignalMesh SM-300",
    "VectorNode VN-1280",
    "DataStorm DS-660",
    "PhotonCore PC-512",
    "MegaLink ML-808",
    "TurboArray TA-1500",
    "QuantumGrid QG-909",
    "FluxMatrix FM-420",
    "HyperSwitch HS-77",
    "PulseCore PX-120",
    "NanoMatrix NM-808",
    "VectorPulse VP-3000",
    "CoreFlux CF-66",
    "SignalCore SC-1100",
    "PhotonMesh PM-204",
    "MegaNode MN-950",
    "QuantumLatch QL-72",
    "TurboFabric TF-1000",
    "FluxArray FA-360",
    "HyperGrid HG-808",
    "DataMatrix DM-4200",
    "CoreBridge CB-512",
]


def request_schema(schema: dict) -> dict:
    return normalize_schema_for_builder(schema, property_name="root", include_mock=False)


def response_schema(schema: dict) -> dict:
    return normalize_schema_for_builder(schema, property_name="root", include_mock=True)


def fixed_response(value: object) -> dict:
    return build_fixed_schema_from_example(value)


def _upsert_endpoint(session: Session, payload: EndpointCreate) -> EndpointDefinition:
    statement = select(EndpointDefinition).where(EndpointDefinition.slug == payload.slug)
    existing = session.execute(statement).scalars().first()
    if existing:
        for key, value in payload.dict().items():
            setattr(existing, key, value)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    return create_endpoint(session, payload)


def _catalog_seed_key(slug: str) -> str:
    return f"catalog::{slug}"


def seed():
    seeds = [
        EndpointCreate(
            name="List Quotes",
            slug="list-quotes",
            method="GET",
            path="/api/quotes",
            category="quotes",
            tags=["quotes", "catalog"],
            summary="List funny quotes",
            description="Returns a list of generated joke-style quotes.",
            response_schema=response_schema(
                {
                    "type": "array",
                    "minItems": 2,
                    "maxItems": 4,
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string", "format": "uuid"},
                            "quote": {"type": "string", "x-mock": {"mode": "mocking", "generator": "long_text", "options": {"sentences": 2}}},
                            "author": {"type": "string", "x-mock": {"mode": "mocking", "generator": "full_name"}},
                        },
                        "required": ["id", "quote", "author"],
                    },
                }
            ),
            seed_key=_catalog_seed_key("list-quotes"),
        ),
        EndpointCreate(
            name="Random Quote",
            slug="random-quote",
            method="GET",
            path="/api/quotes/random",
            category="quotes",
            tags=["quotes"],
            summary="Get a random quote",
            response_schema=response_schema(
                {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "format": "uuid"},
                        "quote": {"type": "string", "x-mock": {"mode": "mocking", "generator": "long_text", "options": {"sentences": 1}}},
                        "author": {"type": "string", "x-mock": {"mode": "mocking", "generator": "full_name"}},
                    },
                    "required": ["id", "quote", "author"],
                }
            ),
            seed_key=_catalog_seed_key("random-quote"),
        ),
        EndpointCreate(
            name="List Users",
            slug="list-users",
            method="GET",
            path="/api/users",
            category="users",
            tags=["users", "catalog"],
            summary="List users",
            response_schema=response_schema(
                {
                    "type": "array",
                    "minItems": 3,
                    "maxItems": 5,
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string", "format": "uuid"},
                            "displayName": {"type": "string", "x-mock": {"generator": "full_name"}},
                            "email": {"type": "string", "format": "email"},
                        },
                        "required": ["id", "displayName", "email"],
                    },
                }
            ),
            seed_key=_catalog_seed_key("list-users"),
        ),
        EndpointCreate(
            name="Get User",
            slug="get-user",
            method="GET",
            path="/api/users/{id}",
            category="users",
            tags=["users"],
            summary="Get a user by ID",
            response_schema=response_schema(
                {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "format": "uuid"},
                        "displayName": {"type": "string", "x-mock": {"generator": "full_name"}},
                        "email": {"type": "string", "format": "email"},
                        "role": {
                            "type": "string",
                            "enum": ["Designer of Chaos", "Staff Octopus Liaison", "Senior Button Optimizer"],
                        },
                    },
                    "required": ["id", "displayName", "email", "role"],
                }
            ),
            seed_key=_catalog_seed_key("get-user"),
        ),
        EndpointCreate(
            name="Create User",
            slug="create-user",
            method="POST",
            path="/api/users",
            category="users",
            tags=["users"],
            summary="Create a new user",
            request_schema=request_schema(
                {
                    "type": "object",
                    "properties": {
                        "displayName": {"type": "string"},
                        "email": {"type": "string", "format": "email"},
                    },
                    "required": ["displayName", "email"],
                }
            ),
            response_schema=response_schema(
                {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "format": "uuid"},
                        "displayName": {"type": "string", "x-mock": {"generator": "full_name"}},
                        "email": {"type": "string", "format": "email"},
                        "createdAt": {"type": "string", "format": "date-time"},
                    },
                    "required": ["id", "displayName", "email", "createdAt"],
                }
            ),
            success_status_code=201,
            seed_key=_catalog_seed_key("create-user"),
        ),
        EndpointCreate(
            name="List Devices",
            slug="list-devices",
            method="GET",
            path="/api/devices",
            category="devices",
            tags=["devices"],
            summary="List devices",
            response_schema=response_schema(
                {
                    "type": "array",
                    "minItems": 2,
                    "maxItems": 4,
                    "items": {
                        "type": "object",
                        "properties": {
                            "deviceId": {"type": "string", "format": "uuid"},
                            "model": {"type": "string", "enum": DEVICE_MODELS.copy()},
                            "status": {
                                "type": "string",
                                "enum": ["online", "idle", "calibrating", "vibing"],
                            },
                        },
                        "required": ["deviceId", "model", "status"],
                    },
                }
            ),
            seed_key=_catalog_seed_key("list-devices"),
        ),
        EndpointCreate(
            name="Get Device",
            slug="get-device",
            method="GET",
            path="/api/devices/{deviceId}",
            category="devices",
            tags=["devices"],
            summary="Get device details",
            response_schema=response_schema(
                {
                    "type": "object",
                    "properties": {
                        "deviceId": {"type": "string", "format": "uuid"},
                        "model": {"type": "string", "enum": DEVICE_MODELS.copy()},
                        "status": {"type": "string", "enum": ["online", "idle", "maintenance"]},
                        "lastSeen": {"type": "string", "format": "date-time"},
                    },
                    "required": ["deviceId", "model", "status", "lastSeen"],
                }
            ),
            seed_key=_catalog_seed_key("get-device"),
        ),
        EndpointCreate(
            name="Trigger Something",
            slug="trigger-something",
            method="POST",
            path="/api/devices/{deviceId}/trigger-something",
            category="devices",
            tags=["devices"],
            summary="Trigger a device action",
            request_schema=request_schema(
                {
                    "type": "object",
                    "properties": {"action": {"type": "string"}},
                    "required": ["action"],
                }
            ),
            response_schema=fixed_response(
                {
                    "status": "ok",
                    "message": "The device is now doing the thing. It seems enthusiastic about it.",
                }
            ),
        ),
        EndpointCreate(
            name="Get Something",
            slug="get-something",
            method="GET",
            path="/api/devices/{deviceId}/get-something",
            category="devices",
            tags=["devices"],
            summary="Get device derived data",
            response_schema=response_schema(
                {
                    "type": "object",
                    "properties": {
                        "details": {"type": "string", "x-mock": {"generator": "text", "options": {"sentences": 2}}},
                        "query": {"type": "string", "x-mock": {"mode": "fixed", "value": "please provide something"}},
                    },
                    "required": ["details", "query"],
                }
            ),
            seed_key=_catalog_seed_key("get-something"),
        ),
        EndpointCreate(
            name="Create Order",
            slug="create-order",
            method="POST",
            path="/api/orders",
            category="orders",
            tags=["orders"],
            summary="Create an order",
            request_schema=request_schema(
                {
                    "type": "object",
                    "properties": {
                        "productId": {"type": "string"},
                        "quantity": {"type": "integer", "minimum": 1, "maximum": 10},
                    },
                    "required": ["productId", "quantity"],
                }
            ),
            response_schema=response_schema(
                {
                    "type": "object",
                    "properties": {
                        "orderId": {"type": "string", "x-mock": {"generator": "uuid"}},
                        "status": {"type": "string", "enum": ["pending", "confirmed"]},
                    },
                    "required": ["orderId", "status"],
                }
            ),
            success_status_code=201,
            seed_key=_catalog_seed_key("create-order"),
        ),
        EndpointCreate(
            name="Get Order",
            slug="get-order",
            method="GET",
            path="/api/orders/{id}",
            category="orders",
            tags=["orders"],
            summary="Get an order",
            response_schema=response_schema(
                {
                    "type": "object",
                    "properties": {
                        "orderId": {"type": "string", "x-mock": {"generator": "uuid"}},
                        "status": {"type": "string", "enum": ["processing", "packed", "sent"]},
                        "total": {"type": "number", "minimum": 10, "maximum": 500, "x-mock": {"generator": "price"}},
                    },
                    "required": ["orderId", "status", "total"],
                }
            ),
            seed_key=_catalog_seed_key("get-order"),
        ),
        EndpointCreate(
            name="Authorize Payment",
            slug="authorize-payment",
            method="POST",
            path="/api/payments/authorize",
            category="payments",
            tags=["payments"],
            summary="Authorize a payment",
            request_schema=request_schema(
                {
                    "type": "object",
                    "properties": {
                        "amount": {"type": "number", "minimum": 1},
                        "currency": {"type": "string"},
                        "cardLast4": {"type": "string", "minLength": 4, "maxLength": 4},
                    },
                    "required": ["amount", "currency", "cardLast4"],
                }
            ),
            response_schema=response_schema(
                {
                    "type": "object",
                    "properties": {
                        "transactionId": {"type": "string", "x-mock": {"generator": "uuid"}},
                        "status": {"type": "string", "enum": ["authorized", "requires_review"]},
                    },
                    "required": ["transactionId", "status"],
                }
            ),
            seed_key=_catalog_seed_key("authorize-payment"),
        ),
        EndpointCreate(
            name="Report Generation Job",
            slug="report-job",
            method="POST",
            path="/api/jobs/report-generation",
            category="jobs",
            tags=["jobs"],
            summary="Create a report generation job",
            request_schema=request_schema(
                {
                    "type": "object",
                    "properties": {"reportType": {"type": "string"}},
                    "required": ["reportType"],
                }
            ),
            response_schema=response_schema(
                {
                    "type": "object",
                    "properties": {
                        "jobId": {"type": "string", "x-mock": {"generator": "uuid"}},
                        "status": {"type": "string", "enum": ["pending", "queued"]},
                    },
                    "required": ["jobId", "status"],
                }
            ),
            success_status_code=202,
            seed_key=_catalog_seed_key("report-job"),
        ),
        EndpointCreate(
            name="Job Status",
            slug="job-status",
            method="GET",
            path="/api/jobs/{jobId}/status",
            category="jobs",
            tags=["jobs"],
            summary="Get job status",
            response_schema=response_schema(
                {
                    "type": "object",
                    "properties": {
                        "jobId": {"type": "string", "x-mock": {"generator": "uuid"}},
                        "status": {"type": "string", "enum": ["in_progress", "complete", "waiting_for_snacks"]},
                        "progress": {"type": "number", "minimum": 0, "maximum": 100},
                    },
                    "required": ["jobId", "status", "progress"],
                }
            ),
            seed_key=_catalog_seed_key("job-status"),
        ),
        EndpointCreate(
            name="Health",
            slug="health",
            method="GET",
            path="/api/health",
            category="system",
            tags=["system"],
            summary="Health check",
            response_schema=fixed_response({"status": "ok"}),
        ),
    ]

    with session_scope() as session:
        for item in seeds:
            _upsert_endpoint(session, item)


if __name__ == "__main__":
    seed()
