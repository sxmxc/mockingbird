from __future__ import annotations

from enum import Enum
from typing import Any


class AdminRole(str, Enum):
    viewer = "viewer"
    editor = "editor"
    superuser = "superuser"


class AdminPermission(str, Enum):
    routes_read = "routes.read"
    routes_write = "routes.write"
    routes_preview = "routes.preview"
    users_manage = "users.manage"


DEFAULT_ADMIN_ROLE = AdminRole.editor

ROLE_LABELS: dict[AdminRole, str] = {
    AdminRole.viewer: "Viewer",
    AdminRole.editor: "Editor",
    AdminRole.superuser: "Superuser",
}

ROLE_PERMISSIONS: dict[AdminRole, tuple[AdminPermission, ...]] = {
    AdminRole.viewer: (
        AdminPermission.routes_read,
        AdminPermission.routes_preview,
    ),
    AdminRole.editor: (
        AdminPermission.routes_read,
        AdminPermission.routes_write,
        AdminPermission.routes_preview,
    ),
    AdminRole.superuser: (
        AdminPermission.routes_read,
        AdminPermission.routes_write,
        AdminPermission.routes_preview,
        AdminPermission.users_manage,
    ),
}


def normalize_admin_role(
    role: AdminRole | str | None,
    *,
    fallback_is_superuser: bool = False,
) -> AdminRole:
    if isinstance(role, AdminRole):
        return role

    normalized = str(role or "").strip().lower()
    if not normalized:
        return AdminRole.superuser if fallback_is_superuser else DEFAULT_ADMIN_ROLE

    try:
        return AdminRole(normalized)
    except ValueError as error:
        valid_roles = ", ".join(member.value for member in AdminRole)
        raise ValueError(f"Role must be one of: {valid_roles}.") from error


def permissions_for_role(
    role: AdminRole | str | None,
    *,
    fallback_is_superuser: bool = False,
) -> list[AdminPermission]:
    normalized_role = normalize_admin_role(role, fallback_is_superuser=fallback_is_superuser)
    return list(ROLE_PERMISSIONS[normalized_role])


def role_has_permission(
    role: AdminRole | str | None,
    permission: AdminPermission,
    *,
    fallback_is_superuser: bool = False,
) -> bool:
    return permission in permissions_for_role(role, fallback_is_superuser=fallback_is_superuser)


def user_has_permission(user: Any, permission: AdminPermission) -> bool:
    return role_has_permission(
        getattr(user, "role", None),
        permission,
        fallback_is_superuser=bool(getattr(user, "is_superuser", False)),
    )
