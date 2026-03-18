import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { defineComponent } from "vue";
import EndpointsView from "./EndpointsView.vue";
import { listEndpoints } from "../api/admin";
import { vuetify } from "../plugins/vuetify";
import type { Endpoint, EndpointDraft } from "../types/endpoints";

const authStub = vi.hoisted(() => ({
  logout: vi.fn(),
  canPreviewRoutes: { value: true },
  canWriteRoutes: { value: true },
  mustChangePassword: { value: false },
  session: {
    value: {
      expires_at: "2026-03-16T00:00:00Z",
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
        password_changed_at: "2026-03-16T00:00:00Z",
        created_at: "2026-03-16T00:00:00Z",
        updated_at: "2026-03-16T00:00:00Z",
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
    listEndpoints: vi.fn(),
    createEndpoint: vi.fn(),
    updateEndpoint: vi.fn(),
    deleteEndpoint: vi.fn(),
  };
});

// eslint-disable-next-line vue/one-component-per-file
const EndpointCatalogStub = defineComponent({
  props: {
    activeEndpointId: {
      type: Number,
      default: null,
    },
    allowCreate: {
      type: Boolean,
      default: true,
    },
    allowDuplicate: {
      type: Boolean,
      default: true,
    },
    endpoints: {
      type: Array as () => Endpoint[],
      required: true,
    },
    error: {
      type: String,
      default: null,
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["create", "duplicate", "refresh", "select"],
  template: `
    <div>
      <button type="button" @click="$emit('refresh')">Refresh catalog</button>
      <button type="button" @click="$emit('select', endpoints[0]?.id)" :disabled="!endpoints.length">Select first</button>
      <div data-testid="catalog-error">{{ error ?? "" }}</div>
      <div data-testid="catalog-loading">{{ loading ? "loading" : "idle" }}</div>
      <div data-testid="catalog-active">{{ activeEndpointId ?? "" }}</div>
      <div data-testid="catalog-allow-create">{{ allowCreate ? "yes" : "no" }}</div>
      <div data-testid="catalog-allow-duplicate">{{ allowDuplicate ? "yes" : "no" }}</div>
      <div data-testid="catalog-names">{{ endpoints.map((endpoint) => endpoint.name).join(" | ") }}</div>
    </div>
  `,
});

// eslint-disable-next-line vue/one-component-per-file
const EndpointSettingsFormStub = defineComponent({
  props: {
    draft: {
      type: Object as () => EndpointDraft,
      required: true,
    },
  },
  emits: ["change", "delete", "duplicate", "open-schema", "preview", "submit"],
  template: `
    <div>
      <div data-testid="draft-name">{{ draft.name }}</div>
      <button type="button" @click="$emit('change', { name: 'Working copy' })">Edit draft</button>
    </div>
  `,
});

function createRouterInstance() {
  const viewStub = { template: "<div />" };

  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/login", name: "login", component: viewStub },
      { path: "/endpoints", name: "endpoints-browse", component: viewStub },
      { path: "/endpoints/new", name: "endpoints-create", component: viewStub },
      { path: "/endpoints/:endpointId", name: "endpoints-edit", component: viewStub },
      { path: "/endpoints/:endpointId/schema", name: "schema-editor", component: viewStub },
      { path: "/endpoints/:endpointId/preview", name: "endpoint-preview", component: viewStub },
    ],
  });
}

function createEndpoint(id: number, overrides: Partial<Endpoint> = {}): Endpoint {
  return {
    id,
    name: `Endpoint ${id}`,
    slug: `endpoint-${id}`,
    method: "GET",
    path: `/api/resource-${id}`,
    category: id % 2 === 0 ? "billing" : "users",
    tags: [id % 2 === 0 ? "billing" : "users"],
    summary: null,
    description: null,
    enabled: true,
    auth_mode: "none",
    request_schema: {},
    response_schema: {},
    success_status_code: 200,
    error_rate: 0,
    latency_min_ms: 0,
    latency_max_ms: 0,
    seed_key: null,
    created_at: "2026-03-16T00:00:00Z",
    updated_at: "2026-03-16T00:00:00Z",
    ...overrides,
  };
}

async function renderView(path: string, mode: "browse" | "create" | "edit") {
  const router = createRouterInstance();
  await router.push(path);
  await router.isReady();

  return {
    router,
    ...render(EndpointsView, {
      props: {
        mode,
      },
      global: {
        plugins: [vuetify, router],
        stubs: {
          EndpointCatalog: EndpointCatalogStub,
          EndpointSettingsForm: EndpointSettingsFormStub,
        },
      },
    }),
  };
}

describe("EndpointsView", () => {
  beforeEach(() => {
    vi.mocked(listEndpoints).mockReset();
    authStub.logout.mockReset();
    authStub.canPreviewRoutes.value = true;
    authStub.canWriteRoutes.value = true;
    authStub.mustChangePassword.value = false;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("refreshes the catalog in the background without overwriting a dirty selected draft", async () => {
    vi.useFakeTimers();
    vi.mocked(listEndpoints)
      .mockResolvedValueOnce([
        createEndpoint(1, { name: "List users" }),
        createEndpoint(2, { name: "List invoices" }),
      ])
      .mockResolvedValueOnce([
        createEndpoint(1, {
          name: "List users (remote)",
          updated_at: "2026-03-16T00:01:00Z",
        }),
        createEndpoint(2, {
          name: "List invoices (remote)",
          updated_at: "2026-03-16T00:01:00Z",
        }),
      ]);

    await renderView("/endpoints/1", "edit");
    await flushPromises();

    expect(screen.getByTestId("draft-name")).toHaveTextContent("List users");

    await fireEvent.click(screen.getByRole("button", { name: "Edit draft" }));
    expect(screen.getByTestId("draft-name")).toHaveTextContent("Working copy");

    await vi.advanceTimersByTimeAsync(30_000);
    await flushPromises();

    expect(vi.mocked(listEndpoints)).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("catalog-names")).toHaveTextContent("List users | List invoices (remote)");
    expect(screen.getByTestId("draft-name")).toHaveTextContent("Working copy");
  });

  it("applies a newer selected endpoint version when the current draft is still clean", async () => {
    vi.useFakeTimers();
    vi.mocked(listEndpoints)
      .mockResolvedValueOnce([
        createEndpoint(1, { name: "List users" }),
        createEndpoint(2, { name: "List invoices" }),
      ])
      .mockResolvedValueOnce([
        createEndpoint(1, {
          name: "List users (remote)",
          updated_at: "2026-03-16T00:01:00Z",
        }),
        createEndpoint(2, { name: "List invoices" }),
      ]);

    await renderView("/endpoints/1", "edit");
    await flushPromises();

    expect(screen.getByTestId("draft-name")).toHaveTextContent("List users");

    await vi.advanceTimersByTimeAsync(30_000);
    await flushPromises();

    expect(screen.getByTestId("draft-name")).toHaveTextContent("List users (remote)");
  });

  it("routes catalog selection to preview for read-only viewers", async () => {
    authStub.canWriteRoutes.value = false;

    vi.mocked(listEndpoints).mockResolvedValue([
      createEndpoint(1, { name: "List users" }),
    ]);

    const { router } = await renderView("/endpoints", "browse");
    await flushPromises();
    const pushSpy = vi.spyOn(router, "push");

    expect(screen.getByTestId("catalog-allow-create")).toHaveTextContent("no");
    expect(screen.getByTestId("catalog-allow-duplicate")).toHaveTextContent("no");

    await fireEvent.click(screen.getByRole("button", { name: "Select first" }));
    await flushPromises();

    expect(pushSpy).toHaveBeenCalledWith({
      name: "endpoint-preview",
      params: { endpointId: 1 },
    });
  });
});
