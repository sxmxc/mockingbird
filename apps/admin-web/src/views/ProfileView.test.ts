import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import ProfileView from "./ProfileView.vue";
import { changePassword, getAccountProfile, updateAccountProfile } from "../api/admin";
import { vuetify } from "../plugins/vuetify";
import type { AdminUser } from "../types/endpoints";

const baseUser = vi.hoisted<AdminUser>(() => ({
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
}));

const authStub = vi.hoisted(() => ({
  canManageUsers: { value: true },
  logout: vi.fn(),
  mustChangePassword: { value: false },
  roleLabel: { value: "Superuser" },
  session: {
    value: {
      expires_at: "2026-03-18T00:00:00Z",
      token: "session-token",
      user: baseUser,
    },
  },
  updateCurrentSession: vi.fn(),
  user: {
    value: baseUser,
  },
}));

vi.mock("../composables/useAuth", () => ({
  useAuth: () => authStub,
}));

vi.mock("../api/admin", async () => {
  const actual = await vi.importActual<typeof import("../api/admin")>("../api/admin");
  return {
    ...actual,
    changePassword: vi.fn(),
    getAccountProfile: vi.fn(),
    updateAccountProfile: vi.fn(),
  };
});

function createRouterInstance() {
  const viewStub = { template: "<div />" };

  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/login", name: "login", component: viewStub },
      { path: "/account/profile", name: "account-profile", component: viewStub },
    ],
  });
}

async function renderView() {
  const router = createRouterInstance();
  await router.push("/account/profile");
  await router.isReady();

  return render(ProfileView, {
    global: {
      plugins: [vuetify, router],
    },
  });
}

describe("ProfileView", () => {
  beforeEach(() => {
    vi.mocked(getAccountProfile).mockReset();
    vi.mocked(updateAccountProfile).mockReset();
    vi.mocked(changePassword).mockReset();
    authStub.logout.mockReset();
    authStub.updateCurrentSession.mockReset();
    authStub.mustChangePassword.value = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("loads the current profile through the account endpoint", async () => {
    vi.mocked(getAccountProfile).mockResolvedValue(authStub.user.value);

    await renderView();
    await flushPromises();

    expect(vi.mocked(getAccountProfile)).toHaveBeenCalledWith(authStub.session.value);
    expect(screen.getAllByText("codex-ui").length).toBeGreaterThan(0);
    expect(screen.getByText("codex-ui@example.com")).toBeInTheDocument();
    expect(screen.getByText("users.manage")).toBeInTheDocument();
  });

  it("saves profile changes through the dedicated account profile endpoint", async () => {
    vi.mocked(getAccountProfile).mockResolvedValue(authStub.user.value);
    vi.mocked(updateAccountProfile).mockResolvedValue({
      expires_at: authStub.session.value.expires_at,
      user: {
        ...authStub.user.value,
        full_name: "Codex Profile",
        email: "codex-profile@example.com",
        avatar_url: "https://cdn.example.com/codex-profile.png",
        username: "codex-profile",
      },
    });

    await renderView();
    await flushPromises();

    await fireEvent.update(screen.getByLabelText("Full name"), "Codex Profile");
    await fireEvent.update(screen.getByLabelText("Username"), "codex-profile");
    await fireEvent.update(screen.getByLabelText("Email"), "codex-profile@example.com");
    await fireEvent.update(screen.getByLabelText("Profile image URL"), "https://cdn.example.com/codex-profile.png");
    await fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await flushPromises();

    expect(vi.mocked(updateAccountProfile)).toHaveBeenCalledWith(
      {
        username: "codex-profile",
        full_name: "Codex Profile",
        email: "codex-profile@example.com",
        avatar_url: "https://cdn.example.com/codex-profile.png",
      },
      authStub.session.value,
    );
    expect(authStub.updateCurrentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          full_name: "Codex Profile",
          email: "codex-profile@example.com",
          avatar_url: "https://cdn.example.com/codex-profile.png",
          username: "codex-profile",
        }),
      }),
    );
  });
});
