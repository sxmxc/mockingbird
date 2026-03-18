import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  clearStoredSession: vi.fn(),
  getCurrentSession: vi.fn(),
  hasSession: vi.fn(),
  loadStoredSession: vi.fn(),
  loginAdmin: vi.fn(),
  logoutAdmin: vi.fn(),
  persistSession: vi.fn(),
  updateStoredSession: vi.fn(),
}));

vi.mock("../api/admin", async () => {
  const actual = await vi.importActual<typeof import("../api/admin")>("../api/admin");
  return {
    ...actual,
    clearStoredSession: apiMocks.clearStoredSession,
    getCurrentSession: apiMocks.getCurrentSession,
    hasSession: apiMocks.hasSession,
    loadStoredSession: apiMocks.loadStoredSession,
    loginAdmin: apiMocks.loginAdmin,
    logoutAdmin: apiMocks.logoutAdmin,
    persistSession: apiMocks.persistSession,
    updateStoredSession: apiMocks.updateStoredSession,
  };
});

const baseUser = {
  avatar_url: null,
  created_at: "2026-03-15T00:00:00Z",
  email: "admin@example.com",
  full_name: "Admin User",
  gravatar_url: "https://www.gravatar.com/avatar/admin?d=identicon&s=160",
  id: 1,
  is_active: true,
  permissions: ["routes.read", "routes.write", "routes.preview", "users.manage"] as const,
  role: "superuser" as const,
  is_superuser: true,
  last_login_at: null,
  must_change_password: false,
  password_changed_at: "2026-03-15T00:00:00Z",
  updated_at: "2026-03-15T00:00:00Z",
  username: "admin",
};

const baseSession = {
  expires_at: "2026-03-16T00:00:00Z",
  token: "session-token",
  user: baseUser,
};

describe("useAuth", () => {
  beforeEach(() => {
    vi.resetModules();
    apiMocks.clearStoredSession.mockReset();
    apiMocks.getCurrentSession.mockReset();
    apiMocks.hasSession.mockReset();
    apiMocks.loadStoredSession.mockReset();
    apiMocks.loginAdmin.mockReset();
    apiMocks.logoutAdmin.mockReset();
    apiMocks.persistSession.mockReset();
    apiMocks.updateStoredSession.mockReset();
  });

  it("restores a remembered session into authenticated state", async () => {
    apiMocks.loadStoredSession.mockReturnValue(baseSession);
    apiMocks.hasSession.mockImplementation((session: unknown) => Boolean(session));
    apiMocks.getCurrentSession.mockResolvedValue({
      expires_at: baseSession.expires_at,
      user: baseUser,
    });

    const { ensureAuthBooted, useAuth } = await import("./useAuth");
    await ensureAuthBooted();

    const auth = useAuth();

    expect(auth.status.value).toBe("authenticated");
    expect(auth.username.value).toBe("admin");
    expect(apiMocks.updateStoredSession).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "session-token",
      }),
    );
  });

  it("logs in and persists the returned session token", async () => {
    apiMocks.loginAdmin.mockResolvedValue(baseSession);

    const { login, useAuth } = await import("./useAuth");
    const result = await login(" admin ", "admin123", { rememberMe: true });

    const auth = useAuth();

    expect(result).toEqual({ ok: true });
    expect(apiMocks.loginAdmin).toHaveBeenCalledWith({
      username: "admin",
      password: "admin123",
      remember_me: true,
    });
    expect(apiMocks.persistSession).toHaveBeenCalledWith(baseSession, true);
    expect(auth.status.value).toBe("authenticated");
    expect(auth.session.value?.token).toBe("session-token");
  });

  it("derives permission-aware route access from the current session", async () => {
    apiMocks.loginAdmin.mockResolvedValue({
      ...baseSession,
      user: {
        ...baseUser,
        permissions: ["routes.read", "routes.preview"],
        role: "viewer",
        is_superuser: false,
      },
    });

    const { login, useAuth } = await import("./useAuth");
    await login("viewer", "viewer123456", { rememberMe: false });

    const auth = useAuth();

    expect(auth.role.value).toBe("viewer");
    expect(auth.canReadRoutes.value).toBe(true);
    expect(auth.canPreviewRoutes.value).toBe(true);
    expect(auth.canWriteRoutes.value).toBe(false);
    expect(auth.canManageUsers.value).toBe(false);
  });

  it("clears stale stored sessions when restore fails with 401", async () => {
    apiMocks.loadStoredSession.mockReturnValue(baseSession);
    apiMocks.hasSession.mockImplementation((session: unknown) => Boolean(session));

    const { AdminApiError } = await import("../api/admin");
    apiMocks.getCurrentSession.mockRejectedValue(new AdminApiError("Expired", 401));

    const { ensureAuthBooted, useAuth } = await import("./useAuth");
    await ensureAuthBooted();

    const auth = useAuth();

    expect(apiMocks.clearStoredSession).toHaveBeenCalled();
    expect(auth.status.value).toBe("logged_out");
    expect(auth.session.value).toBeNull();
    expect(auth.sessionMessage.value).toBe("Those credentials were rejected.");
  });
});
