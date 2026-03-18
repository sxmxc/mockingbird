import { fireEvent, render, screen, within } from "@testing-library/vue";
import EndpointCatalog from "./EndpointCatalog.vue";
import { vuetify } from "../plugins/vuetify";
import type { Endpoint } from "../types/endpoints";

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
    created_at: "2026-03-15T00:00:00Z",
    updated_at: "2026-03-15T00:00:00Z",
    ...overrides,
  };
}

const endpoints = [
  createEndpoint(1, {
    name: "List users",
    slug: "list-users",
    path: "/api/users",
    category: "users",
    tags: ["users"],
  }),
  createEndpoint(2, {
    name: "List invoices",
    slug: "list-invoices",
    path: "/api/invoices",
    category: "billing",
    tags: ["billing"],
  }),
];

describe("EndpointCatalog", () => {
  it("keeps the search field out of the vertical grow track", () => {
    render(EndpointCatalog, {
      props: {
        activeEndpointId: 1,
        endpoints,
        error: null,
        loading: false,
      },
      global: {
        plugins: [vuetify],
      },
    });

    expect(
      screen.getByPlaceholderText("Search by name, path, method, or category").closest(".catalog-search"),
    ).not.toBeNull();
  });

  it("filters the visible routes by search text", async () => {
    render(EndpointCatalog, {
      props: {
        activeEndpointId: 1,
        endpoints,
        error: null,
        loading: false,
      },
      global: {
        plugins: [vuetify],
      },
    });

    expect(screen.getByText("List users")).toBeInTheDocument();
    expect(screen.getByText("List invoices")).toBeInTheDocument();

    await fireEvent.update(screen.getByPlaceholderText("Search by name, path, method, or category"), "users");

    expect(screen.getByText("List users")).toBeInTheDocument();
    expect(screen.queryByText("List invoices")).not.toBeInTheDocument();
  });

  it("keeps showing the last synced routes when a refresh error is present", () => {
    render(EndpointCatalog, {
      props: {
        activeEndpointId: 1,
        endpoints,
        error: "Showing the last synced catalog. Temporary refresh failure.",
        loading: false,
      },
      global: {
        plugins: [vuetify],
      },
    });

    expect(screen.getByText("Showing the last synced catalog. Temporary refresh failure.")).toBeInTheDocument();
    expect(screen.getByText("List users")).toBeInTheDocument();
    expect(screen.getByText("List invoices")).toBeInTheDocument();
  });

  it("emits duplicate without selecting the row when the copy action is clicked", async () => {
    const handleDuplicate = vi.fn();
    const handleSelect = vi.fn();

    render(EndpointCatalog, {
      props: {
        activeEndpointId: 1,
        endpoints,
        error: null,
        loading: false,
        onDuplicate: handleDuplicate,
        onSelect: handleSelect,
      },
      global: {
        plugins: [vuetify],
      },
    });

    const duplicateButton = document.querySelector(".catalog-duplicate-btn");
    expect(duplicateButton).not.toBeNull();
    await fireEvent.click(duplicateButton as Element);

    expect(handleDuplicate).toHaveBeenCalledWith(1);
    expect(handleSelect).not.toHaveBeenCalled();
  });

  it("paginates long endpoint lists and resets to page one after filtering", async () => {
    const longCatalog = Array.from({ length: 10 }, (_, index) => createEndpoint(index + 1));

    render(EndpointCatalog, {
      props: {
        activeEndpointId: 1,
        endpoints: longCatalog,
        error: null,
        loading: false,
      },
      global: {
        plugins: [vuetify],
      },
    });

    expect(screen.getByText("Endpoint 1")).toBeInTheDocument();
    expect(screen.getByText("Endpoint 8")).toBeInTheDocument();
    expect(screen.queryByText("Endpoint 9")).not.toBeInTheDocument();

    const pagination = screen.getByLabelText("Catalog pagination");
    const pageTwoButton = within(pagination).getByText("2").closest("button");
    expect(pageTwoButton).not.toBeNull();
    await fireEvent.click(pageTwoButton!);

    expect(screen.getByText("Endpoint 9")).toBeInTheDocument();
    expect(screen.getByText("Endpoint 10")).toBeInTheDocument();
    expect(screen.queryByText("Endpoint 1")).not.toBeInTheDocument();

    await fireEvent.update(screen.getByPlaceholderText("Search by name, path, method, or category"), "Endpoint 1");

    expect(screen.getByText("Endpoint 1")).toBeInTheDocument();
    expect(screen.getByText("Endpoint 10")).toBeInTheDocument();
    expect(screen.getByText("Showing 1-2 of 2 routes")).toBeInTheDocument();
  });
});
