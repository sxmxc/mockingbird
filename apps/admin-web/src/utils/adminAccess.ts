import type { AdminPermission, AdminRole, AdminUser } from "../types/endpoints";

export const ROLE_LABELS: Record<AdminRole, string> = {
  viewer: "Viewer",
  editor: "Editor",
  superuser: "Superuser",
};

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  viewer: ["routes.read", "routes.preview"],
  editor: ["routes.read", "routes.write", "routes.preview"],
  superuser: ["routes.read", "routes.write", "routes.preview", "users.manage"],
};

export function roleLabel(role: AdminRole | null | undefined): string {
  return role ? ROLE_LABELS[role] : "Admin";
}

export function permissionsForRole(role: AdminRole | null | undefined): AdminPermission[] {
  return role ? [...ROLE_PERMISSIONS[role]] : [];
}

export function hasAdminPermission(
  user: Pick<AdminUser, "permissions" | "role" | "is_superuser"> | null | undefined,
  permission: AdminPermission,
): boolean {
  if (!user) {
    return false;
  }

  const grantedPermissions = user.permissions?.length
    ? user.permissions
    : permissionsForRole(user.is_superuser ? "superuser" : user.role);

  return grantedPermissions.includes(permission);
}
