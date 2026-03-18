import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import UsersView from "./UsersView.vue";
import { createAdminUser, deleteAdminUser, listAdminUsers, updateAdminUser } from "../api/admin";
import { vuetify } from "../plugins/vuetify";
import type { AdminUser } from "../types/endpoints";

const authStub = vi.hoisted(() => ({
  canManageUsers: { value: true },
  logout: vi.fn(),
  mustChangePassword: { value: false },
  session: {
    value: {
      expires_at: "2026-03-18T00:00:00Z",
      token: "session-token",
      user: {
        id: 1,
        username: "codex-ui",
        full_name: "Codex UI",
        email: "codex-ui@example.com",
        avatar_url: null,
        gravatar_url: "https://www.gravatar.com/avatar/codex-ui?d=identicon&s=160",
        is_active: true,
        role: "superuser",
        permissions: ["routes.read", "routes.write", "routes.preview", "users.manage"],
        is_superuser: true,
        must_change_password: false,
        last_login_at: null,
        password_changed_at: "2026-03-18T00:00:00Z",
        created_at: "2026-03-18T00:00:00Z",
        updated_at: "2026-03-18T00:00:00Z",
      },
    },
  },
  updateCurrentUser: vi.fn(),
  user: {
    value: {
      id: 1,
      username: "codex-ui",
      full_name: "Codex UI",
      email: "codex-ui@example.com",
      avatar_url: null,
      gravatar_url: "https://www.gravatar.com/avatar/codex-ui?d=identicon&s=160",
      is_active: true,
      role: "superuser",
      permissions: ["routes.read", "routes.write", "routes.preview", "users.manage"],
      is_superuser: true,
      must_change_password: false,
      last_login_at: null,
      password_changed_at: "2026-03-18T00:00:00Z",
      created_at: "2026-03-18T00:00:00Z",
      updated_at: "2026-03-18T00:00:00Z",
    },
  },
}));

vi.mock("../composables/useAuth", () => ({
  useAuth: () => authStub,
}));

vi.mock("../api/admin", async () => {
  const actual = await vi.importActual<typeof import("../api/admin")>("../api/admin");
  return {
    ...actual,
    createAdminUser: vi.fn(),
    deleteAdminUser: vi.fn(),
    listAdminUsers: vi.fn(),
    updateAdminUser: vi.fn(),
  };
});

function createUser(id: number, overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id,
    username: `user-${id}`,
    full_name: null,
    email: null,
    avatar_url: null,
    gravatar_url: `https://www.gravatar.com/avatar/user-${id}?d=identicon&s=160`,
    is_active: true,
    role: "editor",
    permissions: ["routes.read", "routes.write", "routes.preview"],
    is_superuser: false,
    must_change_password: false,
    last_login_at: null,
    password_changed_at: "2026-03-18T00:00:00Z",
    created_at: "2026-03-18T00:00:00Z",
    updated_at: "2026-03-18T00:00:00Z",
    ...overrides,
  };
}

function createRouterInstance() {
  const viewStub = { template: "<div />" };

  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/login", name: "login", component: viewStub },
      { path: "/users", name: "users", component: viewStub },
    ],
  });
}

async function renderView() {
  const router = createRouterInstance();
  await router.push("/users");
  await router.isReady();

  return render(UsersView, {
    global: {
      plugins: [vuetify, router],
    },
  });
}

describe("UsersView", () => {
  beforeEach(() => {
    vi.mocked(createAdminUser).mockReset();
    vi.mocked(deleteAdminUser).mockReset();
    vi.mocked(listAdminUsers).mockReset();
    vi.mocked(updateAdminUser).mockReset();
    authStub.logout.mockReset();
    authStub.updateCurrentUser.mockReset();
    authStub.canManageUsers.value = true;
    authStub.mustChangePassword.value = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("loads and renders the admin user directory", async () => {
    vi.mocked(listAdminUsers).mockResolvedValue([
      createUser(1, {
        username: "codex-ui",
        full_name: "Codex UI",
        email: "codex-ui@example.com",
        role: "superuser",
        permissions: ["routes.read", "routes.write", "routes.preview", "users.manage"],
        is_superuser: true,
      }),
      createUser(2, {
        username: "viewer-user",
        full_name: "Viewer Person",
        email: "viewer@example.com",
        role: "viewer",
        permissions: ["routes.read", "routes.preview"],
      }),
    ]);

    await renderView();
    await flushPromises();

    expect(vi.mocked(listAdminUsers)).toHaveBeenCalledWith(authStub.session.value);
    expect(screen.getByRole("button", { name: "New user" })).toBeInTheDocument();
    expect(screen.getByText("Viewer Person")).toBeInTheDocument();
    expect(screen.getByText("viewer@example.com")).toBeInTheDocument();
    expect(screen.getByText(/viewer-user/)).toBeInTheDocument();
    expect(screen.getByText("Superuser")).toBeInTheDocument();
  });

  it("creates a user and refreshes the directory", async () => {
    vi.mocked(listAdminUsers)
      .mockResolvedValueOnce([
        createUser(1, {
          username: "codex-ui",
          full_name: "Codex UI",
          email: "codex-ui@example.com",
          role: "superuser",
          permissions: ["routes.read", "routes.write", "routes.preview", "users.manage"],
          is_superuser: true,
        }),
      ])
      .mockResolvedValueOnce([
        createUser(1, {
          username: "codex-ui",
          full_name: "Codex UI",
          email: "codex-ui@example.com",
          role: "superuser",
          permissions: ["routes.read", "routes.write", "routes.preview", "users.manage"],
          is_superuser: true,
        }),
        createUser(2, {
          username: "new-user",
          full_name: "New User",
          email: "new-user@example.com",
        }),
      ]);
    vi.mocked(createAdminUser).mockResolvedValue(
      createUser(2, {
        username: "new-user",
        full_name: "New User",
        email: "new-user@example.com",
      }),
    );

    await renderView();
    await flushPromises();

    await fireEvent.click(screen.getByRole("button", { name: "New user" }));
    await flushPromises();

    await fireEvent.update(screen.getByLabelText("Full name"), "New User");
    await fireEvent.update(screen.getByLabelText("Username"), "new-user");
    await fireEvent.update(screen.getByLabelText("Email"), "new-user@example.com");
    await fireEvent.update(screen.getByLabelText("Profile image URL"), "https://cdn.example.com/new-user.png");
    await fireEvent.update(screen.getByLabelText("Initial password"), "NewUserPassword123!");
    await fireEvent.click(screen.getByRole("button", { name: "Create user" }));
    await flushPromises();

    expect(vi.mocked(createAdminUser)).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "New User",
        email: "new-user@example.com",
        avatar_url: "https://cdn.example.com/new-user.png",
        username: "new-user",
        password: "NewUserPassword123!",
      }),
      authStub.session.value,
    );
    expect(screen.getByText("Created the new admin user.")).toBeInTheDocument();
    expect(screen.getByText("New User")).toBeInTheDocument();
  });

  it("filters the user directory by name, username, and email", async () => {
    vi.mocked(listAdminUsers).mockResolvedValue([
      createUser(1, {
        username: "codex-ui",
        full_name: "Codex UI",
        email: "codex-ui@example.com",
        role: "superuser",
        permissions: ["routes.read", "routes.write", "routes.preview", "users.manage"],
        is_superuser: true,
      }),
      createUser(2, {
        username: "viewer-user",
        full_name: "Viewer Person",
        email: "viewer@example.com",
        role: "viewer",
        permissions: ["routes.read", "routes.preview"],
      }),
    ]);

    await renderView();
    await flushPromises();

    await fireEvent.update(screen.getByLabelText("Search users"), "viewer@example.com");

    expect(screen.getByText("Viewer Person")).toBeInTheDocument();
    expect(screen.queryByText("Codex UI")).not.toBeInTheDocument();
  });
});
