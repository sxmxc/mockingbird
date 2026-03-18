from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import ConfigDict
from sqlalchemy import Boolean, Column, JSON as SAJSON, String
from sqlmodel import Field, SQLModel

from app.rbac import AdminRole
from app.time_utils import utc_now


class AuthMode(str, Enum):
    none = "none"
    basic = "basic"
    api_key = "api_key"
    bearer = "bearer"


class EndpointDefinition(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    slug: str
    method: str
    path: str
    category: Optional[str] = None
    tags: Optional[List[str]] = Field(default_factory=list, sa_column=Column(SAJSON))
    summary: Optional[str] = None
    description: Optional[str] = None
    enabled: bool = True
    auth_mode: AuthMode = AuthMode.none
    request_schema: Optional[Dict] = Field(default_factory=dict, sa_column=Column(SAJSON))
    response_schema: Optional[Dict] = Field(default_factory=dict, sa_column=Column(SAJSON))
    success_status_code: int = 200
    error_rate: float = 0.0
    latency_min_ms: int = 0
    latency_max_ms: int = 0
    seed_key: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    model_config = ConfigDict(arbitrary_types_allowed=True)


class AdminUser(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(
        sa_column=Column(String(128), nullable=False, unique=True, index=True),
    )
    full_name: Optional[str] = Field(default=None, sa_column=Column(String(160), nullable=True))
    email: Optional[str] = Field(default=None, sa_column=Column(String(320), nullable=True))
    avatar_url: Optional[str] = Field(default=None, sa_column=Column(String(1024), nullable=True))
    password_hash: str = Field(sa_column=Column(String(512), nullable=False))
    is_active: bool = Field(default=True, sa_column=Column(Boolean, nullable=False, server_default="1"))
    role: AdminRole = Field(
        default=AdminRole.editor,
        sa_column=Column(String(32), nullable=False, server_default=AdminRole.editor.value),
    )
    is_superuser: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, server_default="0"))
    failed_login_attempts: int = Field(default=0, nullable=False)
    last_failed_login_at: Optional[datetime] = None
    locked_until: Optional[datetime] = None
    must_change_password: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, server_default="0"))
    last_login_at: Optional[datetime] = None
    password_changed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    model_config = ConfigDict(arbitrary_types_allowed=True)


class AdminSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="adminuser.id", index=True, nullable=False)
    token_hash: str = Field(
        sa_column=Column(String(128), nullable=False, unique=True, index=True),
    )
    remember_me: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, server_default="0"))
    expires_at: datetime
    revoked_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)
    last_used_at: datetime = Field(default_factory=utc_now)

    model_config = ConfigDict(arbitrary_types_allowed=True)
