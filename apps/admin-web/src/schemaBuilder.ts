import type { JsonObject, JsonValue } from "./types/endpoints";

export type BuilderNodeType = "object" | "array" | "string" | "integer" | "number" | "boolean" | "enum";
export type BuilderScope = "request" | "response";
export type MockMode = "generate" | "fixed" | "mocking";
export const PATH_PARAMETER_GENERATOR = "path_parameter";

export interface SchemaBuilderNode {
  children: SchemaBuilderNode[];
  description: string;
  enumValues: string[];
  fixedValue: JsonValue;
  format: string;
  generator: string | null;
  id: string;
  item: SchemaBuilderNode | null;
  maxItems: number | null;
  maxLength: number | null;
  maximum: number | null;
  minItems: number | null;
  minLength: number | null;
  minimum: number | null;
  mode: MockMode;
  name: string;
  parameterSource: string | null;
  required: boolean;
  type: BuilderNodeType;
}

type MutableNode = SchemaBuilderNode;
export type GeneratorOption = { label: string; types: BuilderNodeType[]; value: string };

const ROOT_ID = "builder-root";
const DEFAULT_TEXT_LENGTH = 64;
const DEFAULT_LONG_TEXT_LENGTH = 280;
const DEFAULT_MAX_ITEMS = 3;
const VALUE_TYPE_ALIASES: Record<string, string> = {
  uuid: "id",
  guid: "id",
  full_name: "name",
  fullname: "name",
  float: "number",
  longtext: "long_text",
  keyboard: "keyboard_key",
  keycap: "keyboard_key",
  hotkey: "keyboard_key",
  filename: "file_name",
  mime: "mime_type",
  contenttype: "mime_type",
  mediatype: "mime_type",
  systemverb: "verb",
};
const STRING_FORMAT_BY_VALUE_TYPE: Record<string, string> = {
  id: "uuid",
  email: "email",
  url: "uri",
  date: "date",
  datetime: "date-time",
  time: "time",
};

let nodeCounter = 0;

function cloneJsonValue(value: JsonValue): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function nextNodeId(): string {
  nodeCounter += 1;
  return `node-${nodeCounter}`;
}

function defaultFixedValue(type: BuilderNodeType): JsonValue {
  switch (type) {
    case "object":
      return {};
    case "array":
      return [];
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    case "enum":
    case "string":
    default:
      return "";
  }
}

function defaultName(type: BuilderNodeType): string {
  switch (type) {
    case "object":
      return "group";
    case "array":
      return "items";
    case "integer":
      return "count";
    case "number":
      return "value";
    case "boolean":
      return "flag";
    case "enum":
      return "status";
    case "string":
    default:
      return "field";
  }
}

export function normalizeMockValueType(rawValueType: string | null | undefined): string | null {
  const normalized = String(rawValueType ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return VALUE_TYPE_ALIASES[normalized] ?? normalized;
}

export function formatForValueType(valueType: string | null | undefined): string {
  const normalized = normalizeMockValueType(valueType);
  return normalized ? STRING_FORMAT_BY_VALUE_TYPE[normalized] ?? "" : "";
}

export function recommendedMaxLengthForValueType(valueType: string | null | undefined): number {
  return normalizeMockValueType(valueType) === "long_text" ? DEFAULT_LONG_TEXT_LENGTH : DEFAULT_TEXT_LENGTH;
}

export function valueTypeLabel(valueType: string | null | undefined): string {
  const normalized = normalizeMockValueType(valueType);
  if (!normalized) {
    return "Generic value";
  }

  return GENERATOR_OPTIONS.find((option) => option.value === normalized)?.label ?? normalized.replace(/_/g, " ");
}

export function preferredNodeTypeForValueType(valueType: string | null | undefined): BuilderNodeType | null {
  const normalized = normalizeMockValueType(valueType);
  if (!normalized) {
    return null;
  }

  const match = GENERATOR_OPTIONS.find((option) => option.value === normalized);
  return match?.types[0] ?? null;
}

export function defaultGeneratorForType(type: BuilderNodeType, name = "value", format = ""): string | null {
  const normalizedName = name.replace(/[-\s]/g, "_").toLowerCase();
  const normalizedFormat = format.toLowerCase();

  if (type === "enum") {
    return "enum";
  }

  if (type === "string") {
    if (normalizedFormat === "email" || normalizedName.includes("email")) {
      return "email";
    }
    if (normalizedFormat === "uuid" || normalizedName === "id" || normalizedName.endsWith("_id")) {
      return "id";
    }
    if (normalizedFormat === "uri" || normalizedFormat === "url") {
      return "url";
    }
    if (normalizedFormat === "date") {
      return "date";
    }
    if (normalizedFormat === "date-time") {
      return "datetime";
    }
    if (normalizedFormat === "time") {
      return "time";
    }
    if (normalizedName === "username" || normalizedName === "user_name" || normalizedName === "handle") {
      return "username";
    }
    if (normalizedName.includes("password")) {
      return "password";
    }
    if (
      normalizedName === "keyboard_key"
      || normalizedName === "keyboardkey"
      || normalizedName === "shortcut"
      || normalizedName === "shortcut_key"
      || normalizedName === "shortcutkey"
      || normalizedName === "hotkey"
      || normalizedName === "key_name"
      || normalizedName === "keyname"
      || normalizedName === "keycap"
    ) {
      return "keyboard_key";
    }
    if (
      normalizedName === "verb"
      || normalizedName === "action"
      || normalizedName === "command"
      || normalizedName === "operation"
      || normalizedName === "job_action"
      || normalizedName === "jobaction"
      || normalizedName === "system_action"
      || normalizedName === "systemaction"
    ) {
      return "verb";
    }
    if (
      normalizedName === "file_name"
      || normalizedName === "filename"
      || normalizedName === "document_name"
      || normalizedName === "documentname"
      || normalizedName === "attachment_name"
      || normalizedName === "attachmentname"
    ) {
      return "file_name";
    }
    if (
      normalizedName === "mime_type"
      || normalizedName === "mimetype"
      || normalizedName === "content_type"
      || normalizedName === "contenttype"
      || normalizedName === "media_type"
      || normalizedName === "mediatype"
    ) {
      return "mime_type";
    }
    if (normalizedName.includes("slug")) {
      return "slug";
    }
    if (normalizedName === "firstname" || normalizedName === "first_name") {
      return "first_name";
    }
    if (normalizedName === "lastname" || normalizedName === "last_name") {
      return "last_name";
    }
    if (normalizedName.includes("company")) {
      return "company";
    }
    if (normalizedName.includes("phone")) {
      return "phone";
    }
    if (normalizedName.includes("address")) {
      return "street_address";
    }
    if (normalizedName.includes("city")) {
      return "city";
    }
    if (normalizedName.includes("state")) {
      return "state";
    }
    if (normalizedName.includes("country")) {
      return "country";
    }
    if (normalizedName.includes("postal") || normalizedName.includes("zip")) {
      return "postal_code";
    }
    if (normalizedName.includes("avatar") || normalizedName.includes("image")) {
      return "avatar_url";
    }
    if (
      normalizedName.includes("quote")
      || normalizedName.includes("message")
      || normalizedName.includes("details")
      || normalizedName.includes("description")
      || normalizedName.includes("content")
      || normalizedName === "body"
    ) {
      return "long_text";
    }
    if (normalizedName.includes("name")) {
      return "name";
    }
    return "text";
  }

  if (type === "integer") {
    return "integer";
  }

  if (type === "number") {
    return normalizedName.includes("price") || normalizedName.includes("amount") || normalizedName.includes("total")
      ? "price"
      : "number";
  }

  if (type === "boolean") {
    return "boolean";
  }

  return null;
}

export const GENERATOR_OPTIONS: GeneratorOption[] = [
  { value: "text", label: "Text", types: ["string"] },
  { value: "long_text", label: "Long text", types: ["string"] },
  { value: "id", label: "ID / GUID", types: ["string"] },
  { value: "username", label: "Username", types: ["string"] },
  { value: "password", label: "Password", types: ["string"] },
  { value: "keyboard_key", label: "Keyboard key", types: ["string"] },
  { value: "verb", label: "Verb", types: ["string"] },
  { value: "email", label: "Email", types: ["string"] },
  { value: "url", label: "URL", types: ["string"] },
  { value: "slug", label: "Slug", types: ["string"] },
  { value: "file_name", label: "File name", types: ["string"] },
  { value: "mime_type", label: "MIME type", types: ["string"] },
  { value: "date", label: "Date", types: ["string"] },
  { value: "datetime", label: "DateTime", types: ["string"] },
  { value: "time", label: "Time", types: ["string"] },
  { value: "first_name", label: "First name", types: ["string"] },
  { value: "last_name", label: "Last name", types: ["string"] },
  { value: "name", label: "Name", types: ["string"] },
  { value: "company", label: "Company", types: ["string"] },
  { value: "phone", label: "Phone", types: ["string"] },
  { value: "street_address", label: "Street address", types: ["string"] },
  { value: "city", label: "City", types: ["string"] },
  { value: "state", label: "State", types: ["string"] },
  { value: "country", label: "Country", types: ["string"] },
  { value: "postal_code", label: "Postal code", types: ["string"] },
  { value: "avatar_url", label: "Avatar URL", types: ["string"] },
  { value: "integer", label: "Integer", types: ["integer"] },
  { value: "number", label: "Number", types: ["number"] },
  { value: "boolean", label: "Boolean", types: ["boolean"] },
  { value: "price", label: "Price", types: ["number"] },
  { value: "enum", label: "Enum choice", types: ["enum"] },
];

export const PALETTE_TYPES: Array<{ description: string; label: string; type: BuilderNodeType }> = [
  { type: "object", label: "Object", description: "Nest named fields" },
  { type: "array", label: "Array", description: "Repeat one item shape" },
  { type: "string", label: "String", description: "Text, IDs, dates, URLs" },
  { type: "enum", label: "Enum", description: "Pick from a known list" },
  { type: "integer", label: "Integer", description: "Whole numbers" },
  { type: "number", label: "Number", description: "Decimals and prices" },
  { type: "boolean", label: "Boolean", description: "True / false" },
];

export function createNode(
  type: BuilderNodeType,
  scope: BuilderScope,
  overrides: Partial<SchemaBuilderNode> = {},
): SchemaBuilderNode {
  const nextType = overrides.type ?? type;
  const isArray = nextType === "array";
  const isObject = nextType === "object";
  const generator =
    overrides.generator ??
    (scope === "response" ? defaultGeneratorForType(nextType, overrides.name ?? defaultName(nextType), overrides.format ?? "") : null);

  return {
    ...overrides,
    children: overrides.children ?? (isObject ? [] : []),
    description: overrides.description ?? "",
    enumValues: overrides.enumValues ?? (nextType === "enum" ? ["pending", "active"] : []),
    fixedValue: overrides.fixedValue ?? defaultFixedValue(nextType),
    format: overrides.format ?? "",
    generator,
    id: overrides.id ?? nextNodeId(),
    item: overrides.item ?? (isArray ? createNode("string", scope, { name: "item" }) : null),
    maxItems: overrides.maxItems ?? (isArray ? DEFAULT_MAX_ITEMS : null),
    maxLength: overrides.maxLength ?? (nextType === "string" ? recommendedMaxLengthForValueType(generator) : null),
    maximum: overrides.maximum ?? null,
    minItems: overrides.minItems ?? (isArray ? 1 : null),
    minLength: overrides.minLength ?? (nextType === "string" ? null : null),
    minimum: overrides.minimum ?? null,
    mode: overrides.mode ?? "generate",
    name: overrides.name ?? defaultName(nextType),
    parameterSource: overrides.parameterSource ?? null,
    required: overrides.required ?? false,
    type: nextType,
  };
}

export function createRootNode(scope: BuilderScope, type: BuilderNodeType = "object"): SchemaBuilderNode {
  const root = createNode(type, scope, {
    id: ROOT_ID,
    name: "root",
    required: true,
  });
  return root;
}

function cloneNode(node: SchemaBuilderNode): SchemaBuilderNode {
  return {
    ...node,
    fixedValue: cloneJsonValue(node.fixedValue),
    enumValues: [...node.enumValues],
    children: node.children.map(cloneNode),
    item: node.item ? cloneNode(node.item) : null,
  };
}

export function cloneTree(tree: SchemaBuilderNode): SchemaBuilderNode {
  return cloneNode(tree);
}

function buildUniqueName(container: SchemaBuilderNode, candidate: string, excludeId?: string): string {
  if (container.type !== "object") {
    return candidate;
  }

  const siblings = container.children.filter((child) => child.id !== excludeId).map((child) => child.name);
  if (!siblings.includes(candidate)) {
    return candidate;
  }

  let suffix = 2;
  while (siblings.includes(`${candidate}${suffix}`)) {
    suffix += 1;
  }
  return `${candidate}${suffix}`;
}

function walkNode(
  node: SchemaBuilderNode,
  callback: (current: MutableNode, parent: MutableNode | null) => boolean,
  parent: MutableNode | null = null,
): boolean {
  if (callback(node, parent)) {
    return true;
  }

  for (const child of node.children) {
    if (walkNode(child, callback, node)) {
      return true;
    }
  }

  if (node.item && walkNode(node.item, callback, node)) {
    return true;
  }

  return false;
}

function findMutableNode(root: MutableNode, id: string): { node: MutableNode; parent: MutableNode | null } | null {
  let result: { node: MutableNode; parent: MutableNode | null } | null = null;
  walkNode(root, (node, parent) => {
    if (node.id === id) {
      result = { node, parent };
      return true;
    }
    return false;
  });
  return result;
}

export function findNode(root: SchemaBuilderNode, id: string): SchemaBuilderNode | null {
  const result = findMutableNode(cloneTree(root), id);
  return result?.node ?? null;
}

function isAncestor(root: SchemaBuilderNode, ancestorId: string, candidateId: string): boolean {
  const ancestor = findNode(root, ancestorId);
  if (!ancestor) {
    return false;
  }

  let found = false;
  walkNode(ancestor, (node) => {
    if (node.id === candidateId) {
      found = true;
      return true;
    }
    return false;
  });
  return found;
}

function removeNodeInPlace(root: MutableNode, nodeId: string): SchemaBuilderNode | null {
  const location = findMutableNode(root, nodeId);
  if (!location || !location.parent) {
    return null;
  }

  if (location.parent.type === "array" && location.parent.item?.id === nodeId) {
    const removed = location.parent.item;
    location.parent.item = null;
    return removed;
  }

  const childIndex = location.parent.children.findIndex((child) => child.id === nodeId);
  if (childIndex >= 0) {
    const [removed] = location.parent.children.splice(childIndex, 1);
    return removed;
  }

  return null;
}

function insertNodeInPlace(root: MutableNode, containerId: string, node: SchemaBuilderNode, index?: number): boolean {
  const location = findMutableNode(root, containerId);
  if (!location) {
    return false;
  }

  if (location.node.type === "array") {
    location.node.item = {
      ...node,
      name: "item",
      required: true,
    };
    return true;
  }

  if (location.node.type !== "object") {
    return false;
  }

  const nextNode = {
    ...node,
    name: buildUniqueName(location.node, node.name),
  };

  if (typeof index === "number") {
    location.node.children.splice(index, 0, nextNode);
  } else {
    location.node.children.push(nextNode);
  }
  return true;
}

export function updateNode(
  tree: SchemaBuilderNode,
  nodeId: string,
  updater: (node: SchemaBuilderNode, parent: SchemaBuilderNode | null) => SchemaBuilderNode,
): SchemaBuilderNode {
  const nextTree = cloneTree(tree);
  const location = findMutableNode(nextTree, nodeId);
  if (!location) {
    return tree;
  }

  const updated = updater(cloneNode(location.node), location.parent ? cloneNode(location.parent) : null);
  if (!location.parent) {
    return updated;
  }

  if (location.parent.type === "array" && location.parent.item?.id === nodeId) {
    location.parent.item = updated;
    return nextTree;
  }

  location.parent.children = location.parent.children.map((child) => (child.id === nodeId ? updated : child));
  return nextTree;
}

export function isScalarNode(node: SchemaBuilderNode): boolean {
  return node.type !== "object" && node.type !== "array";
}

export function applyValueType(
  tree: SchemaBuilderNode,
  nodeId: string,
  valueType: string,
  scope: BuilderScope,
): SchemaBuilderNode {
  const normalized = normalizeMockValueType(valueType);
  if (!normalized) {
    return tree;
  }

  return updateNode(tree, nodeId, (node) => {
    if (!isScalarNode(node)) {
      return node;
    }

    const nextType = preferredNodeTypeForValueType(normalized) ?? node.type;
    const nextMode = scope === "response" && node.mode === "fixed" ? "generate" : node.mode;

    const baseNode =
      nextType === node.type
        ? {
            ...node,
            enumValues: [...node.enumValues],
            fixedValue: cloneJsonValue(node.fixedValue),
            children: [],
            item: null,
            parameterSource: null,
          }
        : createNode(nextType, scope, {
            id: node.id,
            name: node.name,
            required: node.required,
            description: node.description,
            mode: scope === "response" ? nextMode : "generate",
          });

    if (nextType !== "string") {
      return {
        ...baseNode,
        mode: scope === "response" ? nextMode : baseNode.mode,
        generator: normalized,
        format: "",
        parameterSource: null,
      };
    }

    const currentRecommendedLength = recommendedMaxLengthForValueType(baseNode.generator);
    const nextRecommendedLength = recommendedMaxLengthForValueType(normalized);

    return {
      ...baseNode,
      mode: scope === "response" ? nextMode : baseNode.mode,
      generator: normalized,
      format: formatForValueType(normalized),
      parameterSource: null,
      maxLength:
        baseNode.maxLength == null
          ? nextRecommendedLength
          : baseNode.maxLength === currentRecommendedLength
            ? nextRecommendedLength
            : normalized === "long_text" && baseNode.maxLength < nextRecommendedLength
              ? nextRecommendedLength
              : baseNode.maxLength,
    };
  });
}

export function applyPathParameter(
  tree: SchemaBuilderNode,
  nodeId: string,
  parameter: string,
  scope: BuilderScope,
): SchemaBuilderNode {
  const trimmedParameter = parameter.trim();
  if (scope !== "response" || !trimmedParameter) {
    return tree;
  }

  return updateNode(tree, nodeId, (node) => {
    if (!isScalarNode(node)) {
      return node;
    }

    return {
      ...node,
      mode: "generate",
      parameterSource: trimmedParameter,
    };
  });
}

export function resetNodeType(tree: SchemaBuilderNode, nodeId: string, nextType: BuilderNodeType, scope: BuilderScope): SchemaBuilderNode {
  return updateNode(tree, nodeId, (node) => {
    const rebuilt = createNode(nextType, scope, {
      id: node.id,
      name: node.name,
      required: node.required,
      description: node.description,
      mode: scope === "response" ? node.mode : "generate",
    });
    return rebuilt;
  });
}

export function addNodeToContainer(
  tree: SchemaBuilderNode,
  containerId: string,
  type: BuilderNodeType,
  scope: BuilderScope,
): SchemaBuilderNode {
  const nextTree = cloneTree(tree);
  const inserted = insertNodeInPlace(nextTree, containerId, createNode(type, scope));
  return inserted ? nextTree : tree;
}

export function insertNewNodeAfterSibling(
  tree: SchemaBuilderNode,
  siblingId: string,
  type: BuilderNodeType,
  scope: BuilderScope,
): SchemaBuilderNode {
  const nextTree = cloneTree(tree);
  const siblingLocation = findMutableNode(nextTree, siblingId);
  if (!siblingLocation || !siblingLocation.parent || siblingLocation.parent.type !== "object") {
    return tree;
  }

  const siblingIndex = siblingLocation.parent.children.findIndex((child) => child.id === siblingId);
  const nextNode = createNode(type, scope, {
    name: buildUniqueName(siblingLocation.parent, defaultName(type)),
  });
  siblingLocation.parent.children.splice(siblingIndex + 1, 0, nextNode);
  return nextTree;
}

export function insertNewNodeBeforeSibling(
  tree: SchemaBuilderNode,
  siblingId: string,
  type: BuilderNodeType,
  scope: BuilderScope,
): SchemaBuilderNode {
  const nextTree = cloneTree(tree);
  const siblingLocation = findMutableNode(nextTree, siblingId);
  if (!siblingLocation || !siblingLocation.parent || siblingLocation.parent.type !== "object") {
    return tree;
  }

  const siblingIndex = siblingLocation.parent.children.findIndex((child) => child.id === siblingId);
  const nextNode = createNode(type, scope, {
    name: buildUniqueName(siblingLocation.parent, defaultName(type)),
  });
  siblingLocation.parent.children.splice(siblingIndex, 0, nextNode);
  return nextTree;
}

export function deleteNode(tree: SchemaBuilderNode, nodeId: string): SchemaBuilderNode {
  if (nodeId === ROOT_ID) {
    return tree;
  }

  const nextTree = cloneTree(tree);
  removeNodeInPlace(nextTree, nodeId);
  return nextTree;
}

function cloneWithFreshIds(node: SchemaBuilderNode): SchemaBuilderNode {
  const next = cloneNode(node);
  next.id = nextNodeId();
  next.children = next.children.map(cloneWithFreshIds);
  next.item = next.item ? cloneWithFreshIds(next.item) : null;
  return next;
}

export function duplicateNode(tree: SchemaBuilderNode, nodeId: string): SchemaBuilderNode {
  const nextTree = cloneTree(tree);
  const location = findMutableNode(nextTree, nodeId);
  if (!location || !location.parent) {
    return tree;
  }

  const duplicate = cloneWithFreshIds(location.node);
  if (location.parent.type === "array") {
    location.parent.item = duplicate;
    return nextTree;
  }

  const index = location.parent.children.findIndex((child) => child.id === nodeId);
  duplicate.name = buildUniqueName(location.parent, duplicate.name);
  location.parent.children.splice(index + 1, 0, duplicate);
  return nextTree;
}

export function moveNodeToContainer(
  tree: SchemaBuilderNode,
  nodeId: string,
  containerId: string,
  index?: number,
): SchemaBuilderNode {
  if (nodeId === ROOT_ID || nodeId === containerId || isAncestor(tree, nodeId, containerId)) {
    return tree;
  }

  const nextTree = cloneTree(tree);
  const removed = removeNodeInPlace(nextTree, nodeId);
  if (!removed) {
    return tree;
  }

  if (!insertNodeInPlace(nextTree, containerId, removed, index)) {
    return tree;
  }
  return nextTree;
}

export function moveNodeAfterSibling(tree: SchemaBuilderNode, nodeId: string, siblingId: string): SchemaBuilderNode {
  if (nodeId === ROOT_ID || nodeId === siblingId || isAncestor(tree, nodeId, siblingId)) {
    return tree;
  }

  const nextTree = cloneTree(tree);
  const siblingLocation = findMutableNode(nextTree, siblingId);
  if (!siblingLocation || !siblingLocation.parent || siblingLocation.parent.type !== "object") {
    return tree;
  }

  const removed = removeNodeInPlace(nextTree, nodeId);
  if (!removed) {
    return tree;
  }

  const refreshedSiblingLocation = findMutableNode(nextTree, siblingId);
  if (!refreshedSiblingLocation || !refreshedSiblingLocation.parent || refreshedSiblingLocation.parent.type !== "object") {
    return tree;
  }

  const siblingIndex = refreshedSiblingLocation.parent.children.findIndex((child) => child.id === siblingId);
  refreshedSiblingLocation.parent.children.splice(siblingIndex + 1, 0, {
    ...removed,
    name: buildUniqueName(refreshedSiblingLocation.parent, removed.name, removed.id),
  });
  return nextTree;
}

export function moveNodeBeforeSibling(tree: SchemaBuilderNode, nodeId: string, siblingId: string): SchemaBuilderNode {
  if (nodeId === ROOT_ID || nodeId === siblingId || isAncestor(tree, nodeId, siblingId)) {
    return tree;
  }

  const nextTree = cloneTree(tree);
  const siblingLocation = findMutableNode(nextTree, siblingId);
  if (!siblingLocation || !siblingLocation.parent || siblingLocation.parent.type !== "object") {
    return tree;
  }

  const removed = removeNodeInPlace(nextTree, nodeId);
  if (!removed) {
    return tree;
  }

  const refreshedSiblingLocation = findMutableNode(nextTree, siblingId);
  if (!refreshedSiblingLocation || !refreshedSiblingLocation.parent || refreshedSiblingLocation.parent.type !== "object") {
    return tree;
  }

  const siblingIndex = refreshedSiblingLocation.parent.children.findIndex((child) => child.id === siblingId);
  refreshedSiblingLocation.parent.children.splice(siblingIndex, 0, {
    ...removed,
    name: buildUniqueName(refreshedSiblingLocation.parent, removed.name, removed.id),
  });
  return nextTree;
}

function normalizeFixedValue(type: BuilderNodeType, value: unknown): JsonValue {
  if (type === "object" || type === "array") {
    if (value !== null && typeof value === "object") {
      return cloneJsonValue(value as JsonValue);
    }
    return defaultFixedValue(type);
  }

  if (type === "integer" || type === "number") {
    return typeof value === "number" ? value : 0;
  }

  if (type === "boolean") {
    return Boolean(value);
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export function schemaToTree(schema: JsonObject | null | undefined, scope: BuilderScope): SchemaBuilderNode {
  if (!schema || Object.keys(schema).length === 0) {
    return createRootNode(scope);
  }

  const resolveGenerator = (
    type: BuilderNodeType,
    name: string,
    format: string,
    rawGenerator: string | null | undefined,
  ): string | null => {
    const explicit = normalizeMockValueType(rawGenerator);
    const inferred = defaultGeneratorForType(type, name, format);

    if (type === "string" && explicit === "text" && inferred === "long_text") {
      return inferred;
    }

    return explicit ?? inferred;
  };

  const buildNode = (rawSchema: JsonObject, name: string, required: boolean, id?: string): SchemaBuilderNode => {
    const rawType = typeof rawSchema.type === "string" ? rawSchema.type : undefined;
    const type: BuilderNodeType =
      Array.isArray(rawSchema.enum) && rawSchema.enum.length > 0
        ? "enum"
        : rawType === "object" || "properties" in rawSchema
          ? "object"
          : rawType === "array" || "items" in rawSchema
            ? "array"
            : rawType === "integer" || rawType === "number" || rawType === "boolean"
              ? rawType
              : "string";

    const mockConfig = scope === "response" && typeof rawSchema["x-mock"] === "object" && rawSchema["x-mock"] !== null
      ? (rawSchema["x-mock"] as JsonObject)
      : null;
    const mockOptions = mockConfig?.options as JsonObject | undefined;
    const rawParameterSource =
      typeof mockConfig?.parameter === "string"
        ? mockConfig.parameter
        : typeof mockOptions?.parameter === "string"
          ? mockOptions.parameter
          : null;
    const parameterSource = scope === "response"
      && (mockConfig?.type === PATH_PARAMETER_GENERATOR || mockConfig?.generator === PATH_PARAMETER_GENERATOR)
      && rawParameterSource
        ? rawParameterSource
        : null;
    const format = typeof rawSchema.format === "string" ? rawSchema.format : "";
    const generator = scope === "response"
      ? parameterSource
        ? defaultGeneratorForType(type, name, format)
        : resolveGenerator(
            type,
            name,
            format,
            typeof mockConfig?.type === "string"
              ? mockConfig.type
              : typeof mockConfig?.generator === "string"
                ? mockConfig.generator
                : null,
          )
      : null;

    const node = createNode(type, scope, {
      id,
      description: typeof rawSchema.description === "string" ? rawSchema.description : "",
      format,
      generator,
      maxItems: typeof rawSchema.maxItems === "number" ? rawSchema.maxItems : type === "array" ? DEFAULT_MAX_ITEMS : null,
      maxLength:
        typeof rawSchema.maxLength === "number"
          ? rawSchema.maxLength
          : type === "string"
            ? recommendedMaxLengthForValueType(generator)
            : null,
      maximum: typeof rawSchema.maximum === "number" ? rawSchema.maximum : null,
      minItems: typeof rawSchema.minItems === "number" ? rawSchema.minItems : type === "array" ? 1 : null,
      minLength: typeof rawSchema.minLength === "number" ? rawSchema.minLength : null,
      minimum: typeof rawSchema.minimum === "number" ? rawSchema.minimum : null,
      mode:
        scope === "response" && mockConfig?.mode === "fixed"
          ? "fixed"
          : scope === "response" && mockConfig?.mode === "mocking"
            ? "mocking"
            : "generate",
      name,
      parameterSource,
      required,
      enumValues: Array.isArray(rawSchema.enum) ? rawSchema.enum.map(String) : [],
      fixedValue:
        scope === "response" ? normalizeFixedValue(type, mockConfig?.value) : defaultFixedValue(type),
    });

    if (type === "object") {
      const properties = (rawSchema.properties as JsonObject | undefined) ?? {};
      const order =
        typeof rawSchema["x-builder"] === "object" &&
        rawSchema["x-builder"] !== null &&
        Array.isArray((rawSchema["x-builder"] as JsonObject).order)
          ? ((rawSchema["x-builder"] as JsonObject).order as JsonValue[]).map(String)
          : Object.keys(properties);

      const requiredFields = Array.isArray(rawSchema.required) ? rawSchema.required.map(String) : [];
      node.children = order
        .filter((key) => key in properties)
        .map((key) => buildNode(properties[key] as JsonObject, key, requiredFields.includes(key)));

      Object.keys(properties)
        .filter((key) => !order.includes(key))
        .forEach((key) => {
          node.children.push(buildNode(properties[key] as JsonObject, key, requiredFields.includes(key)));
        });
    }

    if (type === "array") {
      const items = typeof rawSchema.items === "object" && rawSchema.items ? (rawSchema.items as JsonObject) : { type: "string" };
      node.item = buildNode(items, "item", true);
    }

    return node;
  };

  return buildNode(schema, "root", true, ROOT_ID);
}

export function treeToSchema(tree: SchemaBuilderNode, scope: BuilderScope): JsonObject {
  const buildSchema = (node: SchemaBuilderNode): JsonObject => {
    const base: JsonObject = {};

    if (node.description.trim()) {
      base.description = node.description.trim();
    }

    if (node.type === "object") {
      const properties = node.children.reduce<JsonObject>((accumulator, child) => {
        accumulator[child.name] = buildSchema(child);
        return accumulator;
      }, {});

      base.type = "object";
      base.properties = properties;
      base.required = node.children.filter((child) => child.required).map((child) => child.name);
      base["x-builder"] = { order: node.children.map((child) => child.name) };
    } else if (node.type === "array") {
      base.type = "array";
      base.items = buildSchema(node.item ?? createNode("string", scope, { name: "item" }));
      if (typeof node.minItems === "number") {
        base.minItems = node.minItems;
      }
      if (typeof node.maxItems === "number") {
        base.maxItems = node.maxItems;
      }
    } else {
      base.type = node.type === "enum" ? "string" : node.type;
      if (node.type === "enum") {
        base.enum = node.enumValues.filter(Boolean);
      }
      if (node.type === "string") {
        const resolvedFormat = node.parameterSource ? node.format : node.format || formatForValueType(node.generator);
        if (resolvedFormat) {
          base.format = resolvedFormat;
        }
      }
      if (node.type === "string" && typeof node.minLength === "number") {
        base.minLength = node.minLength;
      }
      if (node.type === "string" && typeof node.maxLength === "number") {
        base.maxLength = node.maxLength;
      }
      if ((node.type === "integer" || node.type === "number") && typeof node.minimum === "number") {
        base.minimum = node.minimum;
      }
      if ((node.type === "integer" || node.type === "number") && typeof node.maximum === "number") {
        base.maximum = node.maximum;
      }
    }

    if (scope === "response") {
      const mockConfig: JsonObject = {
        mode: node.parameterSource ? "generate" : node.mode,
        options: {},
      };
      if (node.parameterSource) {
        mockConfig.type = PATH_PARAMETER_GENERATOR;
        mockConfig.generator = PATH_PARAMETER_GENERATOR;
        mockConfig.parameter = node.parameterSource;
        mockConfig.options = { parameter: node.parameterSource };
      } else if (node.mode === "fixed") {
        mockConfig.value = cloneJsonValue(node.fixedValue);
      } else if (node.generator) {
        mockConfig.type = node.generator;
        mockConfig.generator = node.generator;
      }
      base["x-mock"] = mockConfig;
    }

    return base;
  };

  return buildSchema(tree);
}

function validateNode(node: SchemaBuilderNode, root: boolean): string | null {
  if (!root && !node.name.trim()) {
    return "Every field needs a name before you can save this schema.";
  }

  if (node.type === "object") {
    const seen = new Set<string>();
    for (const child of node.children) {
      const trimmedName = child.name.trim();
      if (!trimmedName) {
        return "Every field needs a name before you can save this schema.";
      }
      if (seen.has(trimmedName)) {
        return `Duplicate field name "${trimmedName}" found in the same object.`;
      }
      seen.add(trimmedName);
      const childError = validateNode(child, false);
      if (childError) {
        return childError;
      }
    }
  }

  if (node.type === "array") {
    if (!node.item) {
      return "Arrays need an item shape before you can save this schema.";
    }
    return validateNode(node.item, false);
  }

  if (node.type === "enum" && node.enumValues.filter(Boolean).length === 0) {
    return "Enum fields need at least one option.";
  }

  return null;
}

export function validateTree(tree: SchemaBuilderNode): string | null {
  return validateNode(tree, true);
}

export function canAcceptChildren(node: SchemaBuilderNode): boolean {
  return node.type === "object" || node.type === "array";
}

export function nodeLabel(node: SchemaBuilderNode, root = false): string {
  if (root) {
    return `Root ${node.type}`;
  }
  return node.name || defaultName(node.type);
}
