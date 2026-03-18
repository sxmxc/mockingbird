import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { defineComponent } from "vue";
import SchemaEditorView from "./SchemaEditorView.vue";
import { getEndpoint, updateEndpoint } from "../api/admin";
import { vuetify } from "../plugins/vuetify";
import type { Endpoint, JsonObject } from "../types/endpoints";

const authStub = vi.hoisted(() => ({
  logout: vi.fn(),
  session: {
    value: {
      expires_at: "2026-03-17T00:00:00Z",
      token: "session-token",
      user: {
        id: 1,
        username: "admin",
        full_name: "Admin User",
        email: "admin@example.com",
        avatar_url: null,
        gravatar_url: "https://www.gravatar.com/avatar/admin?d=identicon&s=160",
        is_active: true,
        role: "superuser",
        permissions: ["routes.read", "routes.write", "routes.preview", "users.manage"],
        is_superuser: true,
        must_change_password: false,
        last_login_at: null,
        password_changed_at: "2026-03-17T00:00:00Z",
        created_at: "2026-03-17T00:00:00Z",
        updated_at: "2026-03-17T00:00:00Z",
      },
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
    getEndpoint: vi.fn(),
    updateEndpoint: vi.fn(),
  };
});

const changedResponseSchema: JsonObject = {
  type: "object",
  properties: {
    status: {
      type: "string",
    },
  },
  required: [],
  "x-builder": {
    order: ["status"],
  },
};

// eslint-disable-next-line vue/one-component-per-file
const SchemaEditorWorkspaceStub = defineComponent({
  emits: ["update:schema", "update:seedKey"],
  setup() {
    return {
      changedResponseSchema,
    };
  },
  template: `
    <div>
      <button type="button" @click="$emit('update:schema', changedResponseSchema)">Change response schema</button>
    </div>
  `,
});

// eslint-disable-next-line vue/one-component-per-file
const RequestParameterEditorStub = defineComponent({
  template: "<div>Request parameter editor</div>",
});

function createRouterInstance() {
  const viewStub = { template: "<div />" };

  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/login", name: "login", component: viewStub },
      { path: "/endpoints", name: "endpoints-browse", component: viewStub },
      { path: "/endpoints/:endpointId", name: "endpoints-edit", component: viewStub },
      { path: "/endpoints/:endpointId/preview", name: "endpoint-preview", component: viewStub },
      { path: "/endpoints/:endpointId/schema", name: "schema-editor", component: SchemaEditorView },
    ],
  });
}

function createEndpoint(overrides: Partial<Endpoint> = {}): Endpoint {
  return {
    id: 1,
    name: "Get user",
    slug: "get-user",
    method: "GET",
    path: "/api/users",
    category: "users",
    tags: ["users"],
    summary: "Returns a mocked user.",
    description: null,
    enabled: true,
    auth_mode: "none",
    request_schema: {},
    response_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
        },
      },
      required: [],
      "x-builder": {
        order: ["id"],
      },
    },
    success_status_code: 200,
    error_rate: 0,
    latency_min_ms: 0,
    latency_max_ms: 0,
    seed_key: null,
    created_at: "2026-03-17T00:00:00Z",
    updated_at: "2026-03-17T00:00:00Z",
    ...overrides,
  };
}

async function renderView() {
  const router = createRouterInstance();
  await router.push("/endpoints/1/schema");
  await router.isReady();

  return {
    router,
    ...render(SchemaEditorView, {
      global: {
        plugins: [vuetify, router],
        stubs: {
          RequestParameterEditor: RequestParameterEditorStub,
          SchemaEditorWorkspace: SchemaEditorWorkspaceStub,
        },
      },
    }),
  };
}

describe("SchemaEditorView", () => {
  beforeEach(() => {
    vi.mocked(getEndpoint).mockReset();
    vi.mocked(updateEndpoint).mockReset();
    authStub.logout.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("only enables save when the schema is dirty and disables it again after saving", async () => {
    const loadedEndpoint = createEndpoint();
    const savedEndpoint = createEndpoint({
      response_schema: changedResponseSchema,
      updated_at: "2026-03-17T00:01:00Z",
    });

    vi.mocked(getEndpoint).mockResolvedValue(loadedEndpoint);
    vi.mocked(updateEndpoint).mockResolvedValue(savedEndpoint);

    await renderView();
    await flushPromises();

    const saveButton = screen.getByRole("button", { name: "Save schema" });
    expect(saveButton).toBeDisabled();

    await fireEvent.click(screen.getByRole("button", { name: "Change response schema" }));
    expect(saveButton).toBeEnabled();

    await fireEvent.click(saveButton);
    await flushPromises();

    expect(updateEndpoint).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        response_schema: changedResponseSchema,
      }),
      expect.objectContaining({
        token: "session-token",
      }),
    );
    expect(screen.getByText("Saved schema changes for Get user.")).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
  });
});
