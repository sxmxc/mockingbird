import { computed, reactive } from "vue";
import {
  AdminApiError,
  clearStoredSession,
  getCurrentSession,
  hasSession,
  loadStoredSession,
  loginAdmin,
  logoutAdmin,
  persistSession,
  updateStoredSession,
} from "../api/admin";
import type { AdminLoginPayload, AdminPermission, AdminRole, AdminSession, AdminSessionSnapshot, AdminUser } from "../types/endpoints";
import { hasAdminPermission, roleLabel } from "../utils/adminAccess";

type AuthStatus = "restoring" | "logged_out" | "authenticating" | "authenticated";

interface LoginOptions {
  rememberMe: boolean;
}

interface LoginResult {
  ok: boolean;
  error?: string;
}

function normalizeAuthError(error: unknown, fallbackMessage: string): string {
  if (error instanceof AdminApiError && error.status === 401) {
    return "Those credentials were rejected.";
  }

  return error instanceof Error ? error.message : fallbackMessage;
}

const state = reactive<{
  session: AdminSession | null;
  sessionMessage: string | null;
  status: AuthStatus;
}>({
  session: null,
  sessionMessage: null,
  status: "restoring",
});

let bootPromise: Promise<void> | null = null;

export const authUsername = computed(() => state.session?.user.username ?? null);
export const isAuthenticated = computed(() => state.status === "authenticated" && hasSession(state.session));
export const isSuperuser = computed(() => Boolean(state.session?.user.is_superuser));
export const mustChangePassword = computed(() => Boolean(state.session?.user.must_change_password));
export const currentRole = computed<AdminRole | null>(() => state.session?.user.role ?? null);
export const currentRoleLabel = computed(() => roleLabel(currentRole.value));
export const currentPermissions = computed<AdminPermission[]>(() => state.session?.user.permissions ?? []);
export const canReadRoutes = computed(() => hasPermissionValue("routes.read"));
export const canWriteRoutes = computed(() => hasPermissionValue("routes.write"));
export const canPreviewRoutes = computed(() => hasPermissionValue("routes.preview"));
export const canManageUsers = computed(() => hasPermissionValue("users.manage"));

export function hasPermissionValue(permission: AdminPermission): boolean {
  return hasAdminPermission(state.session?.user ?? null, permission);
}

function applySessionSnapshot(snapshot: AdminSessionSnapshot): void {
  if (!state.session) {
    return;
  }

  state.session = {
    ...state.session,
    expires_at: snapshot.expires_at,
    user: snapshot.user,
  };
  updateStoredSession(state.session);
}

export async function ensureAuthBooted(): Promise<void> {
  if (bootPromise) {
    return bootPromise;
  }

  bootPromise = (async () => {
    const bootSession = loadStoredSession();

    if (!hasSession(bootSession)) {
      state.session = null;
      state.status = "logged_out";
      return;
    }

    state.status = "restoring";

    try {
      const snapshot = await getCurrentSession(bootSession);
      state.session = {
        ...bootSession,
        expires_at: snapshot.expires_at,
        user: snapshot.user,
      };
      updateStoredSession(state.session);
      state.status = "authenticated";
    } catch (error) {
      clearStoredSession();
      state.session = null;
      state.status = "logged_out";
      state.sessionMessage = normalizeAuthError(error, "Your saved admin session could not be restored.");
    }
  })();

  try {
    await bootPromise;
  } finally {
    bootPromise = null;
  }
}

export async function login(username: string, password: string, options: LoginOptions): Promise<LoginResult> {
  if (!username.trim() || !password) {
    return { ok: false, error: "Enter both username and password." };
  }

  state.status = "authenticating";
  state.sessionMessage = null;

  try {
    const session = await loginAdmin({
      username: username.trim(),
      password,
      remember_me: options.rememberMe,
    } satisfies AdminLoginPayload);
    state.session = session;
    persistSession(session, options.rememberMe);
    state.status = "authenticated";
    return { ok: true };
  } catch (error) {
    clearStoredSession();
    state.session = null;
    state.status = "logged_out";
    return { ok: false, error: normalizeAuthError(error, "We could not sign you in.") };
  }
}

export async function logout(message?: string): Promise<void> {
  const session = state.session;
  clearStoredSession();
  state.session = null;
  state.status = "logged_out";
  state.sessionMessage = message ?? null;

  if (!session) {
    return;
  }

  try {
    await logoutAdmin(session);
  } catch {
    // The local session is already gone, so a network failure here should not block sign-out UX.
  }
}

export function updateCurrentSession(snapshot: AdminSessionSnapshot): void {
  applySessionSnapshot(snapshot);
}

export function updateCurrentUser(user: AdminUser): void {
  if (!state.session) {
    return;
  }

  state.session = {
    ...state.session,
    user,
  };
  updateStoredSession(state.session);
}

export function clearSessionMessage(): void {
  state.sessionMessage = null;
}

export function useAuth() {
  return {
    state,
    status: computed(() => state.status),
    session: computed(() => state.session),
    sessionMessage: computed(() => state.sessionMessage),
    user: computed(() => state.session?.user ?? null),
    username: authUsername,
    role: currentRole,
    roleLabel: currentRoleLabel,
    permissions: currentPermissions,
    isAuthenticated,
    isSuperuser,
    mustChangePassword,
    canReadRoutes,
    canWriteRoutes,
    canPreviewRoutes,
    canManageUsers,
    hasPermission: hasPermissionValue,
    clearSessionMessage,
    login,
    logout,
    ensureBooted: ensureAuthBooted,
    updateCurrentSession,
    updateCurrentUser,
  };
}
