import {
  addNodeToContainer,
  applyPathParameter,
  createNode,
  createRootNode,
  defaultGeneratorForType,
  insertNewNodeAfterSibling,
  moveNodeAfterSibling,
  recommendedMaxLengthForValueType,
  schemaToTree,
  treeToSchema,
  updateNode,
  validateTree,
} from "./schemaBuilder";

describe("schemaBuilder utilities", () => {
  it("round-trips response schemas with builder metadata", () => {
    const source = {
      type: "object",
      properties: {
        id: {
          type: "string",
          format: "uuid",
          "x-mock": { mode: "generate", type: "id", options: {} },
        },
        status: {
          type: "string",
          enum: ["ok", "queued"],
          "x-mock": { mode: "mocking", type: "enum", options: {} },
        },
      },
      required: ["id", "status"],
      "x-builder": { order: ["id", "status"] },
      "x-mock": { mode: "generate", options: {} },
    };

    const tree = schemaToTree(source, "response");
    const roundTripped = treeToSchema(tree, "response");

    expect(roundTripped).toMatchObject(source);
  });

  it("round-trips response string templates through the builder tree", () => {
    const source = {
      type: "object",
      properties: {
        slug: {
          type: "string",
          "x-mock": {
            mode: "generate",
            type: "text",
            options: {},
            template: "order={{request.path.orderId}} base={{value}}",
          },
        },
      },
      required: ["slug"],
      "x-builder": { order: ["slug"] },
      "x-mock": { mode: "generate", options: {} },
    };

    const tree = schemaToTree(source, "response");
    expect(tree.children[0]?.template).toBe("order={{request.path.orderId}} base={{value}}");

    const roundTripped = treeToSchema(tree, "response");
    expect(roundTripped).toMatchObject(source);
  });

  it("adds and reorders fields within object containers", () => {
    let tree = createRootNode("response");
    tree = addNodeToContainer(tree, tree.id, "string", "response");
    tree = addNodeToContainer(tree, tree.id, "number", "response");

    tree = updateNode(tree, tree.children[0].id, (node) => ({ ...node, name: "firstField" }));
    tree = updateNode(tree, tree.children[1].id, (node) => ({ ...node, name: "secondField" }));
    tree = moveNodeAfterSibling(tree, tree.children[0].id, tree.children[1].id);

    const schema = treeToSchema(tree, "response");
    expect((schema["x-builder"] as { order: string[] }).order).toEqual(["secondField", "firstField"]);
  });

  it("inserts a sibling after a selected row", () => {
    let tree = createRootNode("request");
    tree = addNodeToContainer(tree, tree.id, "string", "request");
    tree = updateNode(tree, tree.children[0].id, (node) => ({ ...node, name: "title" }));
    tree = insertNewNodeAfterSibling(tree, tree.children[0].id, "boolean", "request");

    expect(tree.children).toHaveLength(2);
    expect(tree.children[1].type).toBe("boolean");
  });

  it("uses the long-text generator and length defaults for quote-like fields", () => {
    expect(defaultGeneratorForType("string", "quote")).toBe("long_text");

    const node = createNode("string", "response", { name: "quote" });
    expect(node.generator).toBe("long_text");
    expect(node.maxLength).toBe(recommendedMaxLengthForValueType("long_text"));
  });

  it("infers account and system-oriented generators from common field names", () => {
    expect(defaultGeneratorForType("string", "username")).toBe("username");
    expect(defaultGeneratorForType("string", "password")).toBe("password");
    expect(defaultGeneratorForType("string", "shortcutKey")).toBe("keyboard_key");
    expect(defaultGeneratorForType("string", "action")).toBe("verb");
    expect(defaultGeneratorForType("string", "fileName")).toBe("file_name");
    expect(defaultGeneratorForType("string", "contentType")).toBe("mime_type");
  });

  it("upgrades legacy text generators on quote-like schemas inside the builder", () => {
    const tree = schemaToTree(
      {
        type: "object",
        properties: {
          quote: {
            type: "string",
            "x-mock": { mode: "mocking", type: "text", options: {} },
          },
        },
        required: ["quote"],
        "x-builder": { order: ["quote"] },
        "x-mock": { mode: "generate", options: {} },
      },
      "response",
    );

    expect(tree.children[0]?.generator).toBe("long_text");
    expect(tree.children[0]?.maxLength).toBe(recommendedMaxLengthForValueType("long_text"));
  });

  it("round-trips response fields linked to route path parameters", () => {
    let tree = createRootNode("response");
    tree = addNodeToContainer(tree, tree.id, "string", "response");
    tree = updateNode(tree, tree.children[0].id, (node) => ({ ...node, name: "userId" }));
    tree = applyPathParameter(tree, tree.children[0].id, "userId", "response");

    const schema = treeToSchema(tree, "response");
    expect(schema).toMatchObject({
      properties: {
        userId: {
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

    const roundTripped = schemaToTree(schema, "response");
    expect(roundTripped.children[0]?.parameterSource).toBe("userId");
  });

  it("preserves scalar types and constraints when linking route path parameters", () => {
    let tree = createRootNode("response");
    tree = addNodeToContainer(tree, tree.id, "number", "response");
    tree = updateNode(tree, tree.children[0].id, (node) => ({
      ...node,
      name: "deviceId",
      minimum: 10.5,
      maximum: 99.5,
      mode: "fixed",
      fixedValue: 42.25,
    }));
    tree = applyPathParameter(tree, tree.children[0].id, "deviceId", "response");

    expect(tree.children[0]).toMatchObject({
      type: "number",
      minimum: 10.5,
      maximum: 99.5,
      mode: "generate",
      parameterSource: "deviceId",
    });

    const schema = treeToSchema(tree, "response");
    expect(schema).toMatchObject({
      properties: {
        deviceId: {
          type: "number",
          minimum: 10.5,
          maximum: 99.5,
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

    const roundTripped = schemaToTree(schema, "response");
    expect(roundTripped.children[0]).toMatchObject({
      type: "number",
      minimum: 10.5,
      maximum: 99.5,
      parameterSource: "deviceId",
      generator: "number",
    });
  });

  it("validates response templates against the saved path parameters", () => {
    const tree = schemaToTree(
      {
        type: "object",
        properties: {
          message: {
            type: "string",
            "x-mock": {
              mode: "generate",
              type: "text",
              options: {},
              template: "order={{request.path.orderId}} status={{request.query.status}}",
            },
          },
        },
        required: ["message"],
        "x-builder": { order: ["message"] },
        "x-mock": { mode: "generate", options: {} },
      },
      "response",
    );

    expect(validateTree(tree, { pathParameterNames: ["orderId"] })).toBeNull();
    expect(validateTree(tree, { pathParameterNames: ["deviceId"] })).toBe(
      "message: Response template references unknown path parameter 'orderId'.",
    );
  });
});
