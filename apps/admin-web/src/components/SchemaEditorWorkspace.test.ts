import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import SchemaEditorWorkspace from "./SchemaEditorWorkspace.vue";
import { AdminApiError, previewResponse } from "../api/admin";
import { vuetify } from "../plugins/vuetify";
import type { BuilderScope } from "../schemaBuilder";
import type { JsonObject } from "../types/endpoints";

const authStub = vi.hoisted(() => ({
  logout: vi.fn(),
  session: {
    value: {
      expires_at: "2026-03-15T00:00:00Z",
      token: "session-token",
      user: {
        id: 1,
        username: "admin",
        is_active: true,
        is_superuser: true,
        must_change_password: false,
        last_login_at: null,
        password_changed_at: "2026-03-15T00:00:00Z",
        created_at: "2026-03-15T00:00:00Z",
        updated_at: "2026-03-15T00:00:00Z",
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
    previewResponse: vi.fn(),
  };
});

function createRouterInstance() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "editor", component: { template: "<div>editor</div>" } },
      { path: "/login", name: "login", component: { template: "<div>login</div>" } },
    ],
  });
}

async function renderWorkspace(
  props: { pathParameters?: string[]; schema: JsonObject; scope: BuilderScope; seedKey?: string },
): Promise<ReturnType<typeof render> & { router: ReturnType<typeof createRouterInstance> }> {
  const router = createRouterInstance();
  await router.push("/");
  await router.isReady();

  return {
    router,
    ...render(SchemaEditorWorkspace, {
      props,
      global: {
        plugins: [vuetify, router],
      },
    }),
  };
}

function createObjectSchema(propertyName = "quote") {
  return {
    type: "object",
    properties: {
      [propertyName]: {
        type: "string",
      },
    },
    required: [],
    "x-builder": {
      order: [propertyName],
    },
  };
}

describe("SchemaEditorWorkspace", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(previewResponse).mockReset();
    authStub.logout.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("adds a request field through palette drag and drop", async () => {
    const { emitted } = await renderWorkspace({
      schema: {
        type: "object",
        properties: {},
        required: [],
        "x-builder": {
          order: [],
        },
      },
      scope: "request",
    });

    const paletteChip = document.querySelector('[data-palette-type="string"]');
    const rootDropZone = document.querySelector('[data-drop-zone="container"][data-drop-target="builder-root"]');

    expect(paletteChip).not.toBeNull();
    expect(rootDropZone).not.toBeNull();

    await fireEvent.dragStart(paletteChip as Element);
    await fireEvent.drop(rootDropZone as Element);

    const schemaUpdates = emitted()["update:schema"] as Array<[JsonObject]> | undefined;

    expect(schemaUpdates?.at(-1)?.[0]).toMatchObject({
      type: "object",
      properties: {
        field: {
          type: "string",
        },
      },
      required: [],
    });
  }, 30_000);

  it("reorders object siblings through the row insertion anchor", async () => {
    const { emitted } = await renderWorkspace({
      schema: {
        type: "object",
        properties: {
          id: {
            type: "string",
          },
          value: {
            type: "string",
          },
        },
        required: [],
        "x-builder": {
          order: ["id", "value"],
        },
      },
      scope: "request",
    });

    const idNode = screen.getByText("id").closest("[data-node-id]");
    const valueNode = screen.getByText("value").closest("[data-node-id]");

    expect(idNode).not.toBeNull();
    expect(valueNode).not.toBeNull();

    const idAnchor = document.querySelector(
      `[data-drop-zone="row"][data-drop-target="${idNode?.getAttribute("data-node-id")}"]`,
    );
    expect(idAnchor).not.toBeNull();

    await fireEvent.dragStart(valueNode as Element);
    await fireEvent.drop(idAnchor as Element);

    const schemaUpdates = emitted()["update:schema"] as Array<[JsonObject]> | undefined;
    expect(schemaUpdates?.at(-1)?.[0]).toMatchObject({
      "x-builder": {
        order: ["value", "id"],
      },
    });
  }, 30_000);

  it("adds a request field at the end of the current object level", async () => {
    const { emitted } = await renderWorkspace({
      schema: {
        type: "object",
        properties: {
          id: {
            type: "string",
          },
          value: {
            type: "string",
          },
        },
        required: [],
        "x-builder": {
          order: ["id", "value"],
        },
      },
      scope: "request",
    });

    const paletteChip = document.querySelector('[data-palette-type="string"]');
    const endAnchor = document.querySelector('[data-drop-zone="container"][data-drop-target="builder-root"]');
    expect(paletteChip).not.toBeNull();
    expect(endAnchor).not.toBeNull();

    await fireEvent.dragStart(paletteChip as Element);
    await fireEvent.drop(endAnchor as Element);

    const schemaUpdates = emitted()["update:schema"] as Array<[JsonObject]> | undefined;
    expect(schemaUpdates?.at(-1)?.[0]).toMatchObject({
      properties: {
        field: {
          type: "string",
        },
      },
      "x-builder": {
        order: ["id", "value", "field"],
      },
    });
  }, 15_000);

  it("links a response field to a route parameter through the value lane", async () => {
    const { emitted } = await renderWorkspace({
      pathParameters: ["userId", "deviceId"],
      schema: {
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
      scope: "response",
    });

    const idNode = screen.getByText("id").closest("[data-node-id]");
    expect(idNode).not.toBeNull();

    const valueSlot = document.querySelector(
      `[data-drop-zone="value"][data-drop-target="${idNode?.getAttribute("data-node-id")}"]`,
    );
    const parameterPill = document.querySelector('[data-path-parameter="userId"]');

    expect(valueSlot).not.toBeNull();
    expect(parameterPill).not.toBeNull();

    await fireEvent.dragStart(parameterPill as Element);
    await fireEvent.drop(valueSlot as Element);

    const schemaUpdates = emitted()["update:schema"] as Array<[JsonObject]> | undefined;
    expect(schemaUpdates?.at(-1)?.[0]).toMatchObject({
      properties: {
        id: {
          type: "string",
          "x-mock": {
            mode: "generate",
            type: "path_parameter",
            generator: "path_parameter",
            parameter: "userId",
            options: {
              parameter: "userId",
            },
          },
        },
      },
    });
  });

  it("preserves numeric field constraints when linking a route parameter through the value lane", async () => {
    const { emitted } = await renderWorkspace({
      pathParameters: ["deviceId"],
      schema: {
        type: "object",
        properties: {
          deviceId: {
            type: "integer",
            minimum: 10,
            maximum: 99,
          },
        },
        required: [],
        "x-builder": {
          order: ["deviceId"],
        },
      },
      scope: "response",
    });

    const deviceIdNode = screen.getByText("deviceId").closest("[data-node-id]");
    expect(deviceIdNode).not.toBeNull();

    const valueSlot = document.querySelector(
      `[data-drop-zone="value"][data-drop-target="${deviceIdNode?.getAttribute("data-node-id")}"]`,
    );
    const parameterPill = document.querySelector('[data-path-parameter="deviceId"]');

    expect(valueSlot).not.toBeNull();
    expect(parameterPill).not.toBeNull();

    await fireEvent.dragStart(parameterPill as Element);
    await fireEvent.drop(valueSlot as Element);

    const schemaUpdates = emitted()["update:schema"] as Array<[JsonObject]> | undefined;
    expect(schemaUpdates?.at(-1)?.[0]).toMatchObject({
      properties: {
        deviceId: {
          type: "integer",
          minimum: 10,
          maximum: 99,
          "x-mock": {
            mode: "generate",
            type: "path_parameter",
            generator: "path_parameter",
            parameter: "deviceId",
            options: {
              parameter: "deviceId",
            },
          },
        },
      },
    });
  });

  it("assigns value types and behaviors through the scalar value lane", async () => {
    const { emitted } = await renderWorkspace({
      schema: {
        type: "object",
        properties: {
          quote: {
            type: "string",
          },
        },
        required: [],
        "x-builder": {
          order: ["quote"],
        },
      },
      scope: "response",
    });

    const quoteNode = screen.getByText("quote").closest("[data-node-id]");
    expect(quoteNode).not.toBeNull();

    const valueSlot = document.querySelector(
      `[data-drop-zone="value"][data-drop-target="${quoteNode?.getAttribute("data-node-id")}"]`,
    );
    const keyboardKeyPill = document.querySelector('[data-value-type="keyboard_key"]');
    const verbPill = document.querySelector('[data-value-type="verb"]');
    const pricePill = document.querySelector('[data-value-type="price"]');
    const mockingPill = document.querySelector('[data-value-mode="mocking"]');

    expect(valueSlot).not.toBeNull();
    expect(keyboardKeyPill).not.toBeNull();
    expect(verbPill).not.toBeNull();
    expect(pricePill).not.toBeNull();
    expect(mockingPill).not.toBeNull();

    await fireEvent.dragStart(pricePill as Element);
    await fireEvent.drop(valueSlot as Element);

    await fireEvent.dragStart(mockingPill as Element);
    await fireEvent.drop(valueSlot as Element);

    const schemaUpdates = emitted()["update:schema"] as Array<[JsonObject]> | undefined;
    expect(schemaUpdates?.at(-1)?.[0]).toMatchObject({
      properties: {
        quote: {
          type: "number",
          "x-mock": {
            mode: "mocking",
            type: "price",
            generator: "price",
          },
        },
      },
    });
  }, 15_000);

  it("renders generated response previews and emits seed updates from the preview rail", async () => {
    vi.mocked(previewResponse).mockResolvedValue({
      preview: {
        quote: "hello from preview",
      },
    });

    const { emitted } = await renderWorkspace({
      schema: createObjectSchema(),
      scope: "response",
      seedKey: "seed-123",
    });

    await vi.advanceTimersByTimeAsync(400);
    await flushPromises();

    expect(previewResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "object",
      }),
      "seed-123",
      {},
      expect.objectContaining({
        token: "session-token",
      }),
    );

    expect(await screen.findByText(/hello from preview/)).toBeInTheDocument();
    expect(document.querySelector(".code-block--json-editor .json-token--key")).not.toBeNull();
    expect(document.querySelector(".code-block--json-editor .json-token--string")).not.toBeNull();

    await fireEvent.update(screen.getByLabelText("Seed key"), "seed-456");

    expect(emitted()["update:seedKey"]?.at(-1)).toEqual(["seed-456"]);
  });

  it("copies schema and preview json through the schema actions", async () => {
    const clipboardWriteText = vi.mocked(navigator.clipboard.writeText);
    vi.mocked(previewResponse).mockResolvedValue({
      preview: {
        quote: "hello from preview",
      },
    });

    await renderWorkspace({
      schema: createObjectSchema(),
      scope: "response",
    });

    await vi.advanceTimersByTimeAsync(400);
    await flushPromises();

    await fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));
    const copiedSchema = JSON.parse(String(clipboardWriteText.mock.calls[0]?.[0]));
    expect(copiedSchema).toMatchObject({
      type: "object",
      properties: {
        quote: {
          type: "string",
        },
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: "Copy sample" }));
    expect(JSON.parse(String(clipboardWriteText.mock.calls.at(-1)?.[0]))).toEqual({ quote: "hello from preview" });
  }, 30_000);

  it("logs out and redirects to login when preview auth expires", async () => {
    vi.mocked(previewResponse).mockRejectedValue(new AdminApiError("Unauthorized", 401));

    const { router } = await renderWorkspace({
      schema: createObjectSchema("message"),
      scope: "response",
    });

    await vi.advanceTimersByTimeAsync(400);
    await flushPromises();

    expect(authStub.logout).toHaveBeenCalledWith("Your admin session expired. Sign in again before previewing response schemas.");
    expect(router.currentRoute.value.name).toBe("login");
  });
});
