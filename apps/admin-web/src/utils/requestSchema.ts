import type { JsonObject, JsonValue } from "../types/endpoints";
import { extractPathParameters } from "./pathParameters";

export type RequestParameterLocation = "path" | "query";
export type RequestParameterType = "string" | "integer" | "number" | "boolean" | "enum";

export interface RequestParameterDefinition {
  description: string;
  enumValues: string[];
  format: string;
  hasExplicitSchema?: boolean;
  id: string;
  maxLength: number | null;
  maximum: number | null;
  minLength: number | null;
  minimum: number | null;
  name: string;
  required: boolean;
  type: RequestParameterType;
}

export const REQUEST_PARAMETERS_KEY = "x-request";

const EMPTY_PARAMETER_SCHEMA: JsonObject = {
  type: "object",
  properties: {},
  required: [],
  "x-builder": {
    order: [],
  },
};

let parameterCounter = 0;

function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nextParameterId(location: RequestParameterLocation): string {
  parameterCounter += 1;
  return `${location}-parameter-${parameterCounter}`;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceParameterType(schema: JsonObject | null | undefined): RequestParameterType {
  if (Array.isArray(schema?.enum) && schema.enum.length > 0) {
    return "enum";
  }

  if (schema?.type === "integer" || schema?.type === "number" || schema?.type === "boolean") {
    return schema.type;
  }

  return "string";
}

function normalizeOrder(properties: Record<string, JsonValue>, rawOrder: JsonValue | undefined): string[] {
  const order = Array.isArray(rawOrder) ? rawOrder.map(String) : [];

  for (const key of Object.keys(properties)) {
    if (!order.includes(key)) {
      order.push(key);
    }
  }

  return order.filter((key) => key in properties);
}

function sanitizeParameterProperty(name: string, schema: JsonObject | null | undefined): JsonObject {
  const type = coerceParameterType(schema);
  const nextSchema: JsonObject = {
    type: type === "enum" ? "string" : type,
  };

  if (typeof schema?.description === "string" && schema.description.trim()) {
    nextSchema.description = schema.description.trim();
  }

  if (type === "enum") {
    nextSchema.enum = Array.isArray(schema?.enum) ? schema.enum.map(String).filter(Boolean) : [];
  }

  if (type === "string") {
    if (typeof schema?.format === "string" && schema.format.trim()) {
      nextSchema.format = schema.format.trim();
    }
    if (typeof schema?.minLength === "number") {
      nextSchema.minLength = schema.minLength;
    }
    if (typeof schema?.maxLength === "number") {
      nextSchema.maxLength = schema.maxLength;
    }
  }

  if (type === "integer" || type === "number") {
    if (typeof schema?.minimum === "number") {
      nextSchema.minimum = schema.minimum;
    }
    if (typeof schema?.maximum === "number") {
      nextSchema.maximum = schema.maximum;
    }
  }

  return nextSchema;
}

function fitStringPreviewValue(value: string, definition: RequestParameterDefinition): string {
  let nextValue = value;

  if (typeof definition.maxLength === "number" && definition.maxLength >= 0) {
    nextValue = nextValue.slice(0, definition.maxLength);
  }

  if (typeof definition.minLength === "number" && definition.minLength > nextValue.length) {
    nextValue = nextValue.padEnd(definition.minLength, "x");
  }

  if (typeof definition.maxLength === "number" && definition.maxLength >= 0 && nextValue.length > definition.maxLength) {
    nextValue = nextValue.slice(0, definition.maxLength);
  }

  return nextValue;
}

export function createEmptyRequestParameterSchema(): JsonObject {
  return cloneJsonValue(EMPTY_PARAMETER_SCHEMA);
}

export function createRequestParameterDefinition(
  location: RequestParameterLocation,
  overrides: Partial<RequestParameterDefinition> = {},
): RequestParameterDefinition {
  return {
    description: overrides.description ?? "",
    enumValues: overrides.enumValues ?? (overrides.type === "enum" ? ["sample"] : []),
    format: overrides.format ?? "",
    hasExplicitSchema: overrides.hasExplicitSchema ?? true,
    id: overrides.id ?? nextParameterId(location),
    maxLength: overrides.maxLength ?? null,
    maximum: overrides.maximum ?? null,
    minLength: overrides.minLength ?? null,
    minimum: overrides.minimum ?? null,
    name: overrides.name ?? (location === "path" ? "parameter" : "queryParam"),
    required: overrides.required ?? (location === "path"),
    type: overrides.type ?? "string",
  };
}

export function extractRequestBodySchema(schema: JsonObject | null | undefined): JsonObject {
  if (!isJsonObject(schema) || Object.keys(schema).length === 0) {
    return {};
  }

  const bodySchema = cloneJsonValue(schema);
  delete bodySchema[REQUEST_PARAMETERS_KEY];
  return bodySchema;
}

function extractRequestParameterSchema(
  schema: JsonObject | null | undefined,
  location: RequestParameterLocation,
): JsonObject {
  const extension = isJsonObject(schema?.[REQUEST_PARAMETERS_KEY]) ? (schema?.[REQUEST_PARAMETERS_KEY] as JsonObject) : null;
  const rawSchema = isJsonObject(extension?.[location]) ? (extension?.[location] as JsonObject) : null;
  if (!rawSchema) {
    return createEmptyRequestParameterSchema();
  }

  const rawProperties = isJsonObject(rawSchema.properties) ? (rawSchema.properties as Record<string, JsonValue>) : {};
  const order = normalizeOrder(rawProperties, isJsonObject(rawSchema["x-builder"]) ? rawSchema["x-builder"].order : undefined);
  const properties = order.reduce<JsonObject>((accumulator, key) => {
    const propertySchema = rawProperties[key];
    accumulator[key] = sanitizeParameterProperty(key, isJsonObject(propertySchema) ? (propertySchema as JsonObject) : null);
    return accumulator;
  }, {});

  return {
    type: "object",
    properties,
    required: Array.isArray(rawSchema.required)
      ? rawSchema.required.map(String).filter((key) => key in properties)
      : [],
    "x-builder": {
      order,
    },
  };
}

export function extractRequestParameterDefinitions(
  schema: JsonObject | null | undefined,
  location: RequestParameterLocation,
): RequestParameterDefinition[] {
  const parameterSchema = extractRequestParameterSchema(schema, location);
  const properties = (parameterSchema.properties as Record<string, JsonValue>) ?? {};
  const requiredSet = new Set(
    Array.isArray(parameterSchema.required) ? parameterSchema.required.map(String) : [],
  );
  const order = Array.isArray((parameterSchema["x-builder"] as JsonObject | undefined)?.order)
    ? ((parameterSchema["x-builder"] as JsonObject).order as JsonValue[]).map(String)
    : Object.keys(properties);

  return order
    .filter((name) => name in properties)
    .map((name, index) => {
      const propertySchema = isJsonObject(properties[name]) ? (properties[name] as JsonObject) : null;
      const type = coerceParameterType(propertySchema);

      return createRequestParameterDefinition(location, {
        id: `${location}-${name}-${index}`,
        name,
        type,
        description: typeof propertySchema?.description === "string" ? propertySchema.description : "",
        format: typeof propertySchema?.format === "string" ? propertySchema.format : "",
        minLength: typeof propertySchema?.minLength === "number" ? propertySchema.minLength : null,
        maxLength: typeof propertySchema?.maxLength === "number" ? propertySchema.maxLength : null,
        minimum: typeof propertySchema?.minimum === "number" ? propertySchema.minimum : null,
        maximum: typeof propertySchema?.maximum === "number" ? propertySchema.maximum : null,
        enumValues: Array.isArray(propertySchema?.enum) ? propertySchema.enum.map(String).filter(Boolean) : [],
        required: location === "path" ? true : requiredSet.has(name),
      });
    });
}

function buildParameterProperty(definition: RequestParameterDefinition): JsonObject {
  const schema: JsonObject = {
    type: definition.type === "enum" ? "string" : definition.type,
  };

  if (definition.description.trim()) {
    schema.description = definition.description.trim();
  }

  if (definition.type === "enum") {
    schema.enum = definition.enumValues.map((value) => value.trim()).filter(Boolean);
  }

  if (definition.type === "string") {
    if (definition.format.trim()) {
      schema.format = definition.format.trim();
    }
    if (typeof definition.minLength === "number") {
      schema.minLength = definition.minLength;
    }
    if (typeof definition.maxLength === "number") {
      schema.maxLength = definition.maxLength;
    }
  }

  if (definition.type === "integer" || definition.type === "number") {
    if (typeof definition.minimum === "number") {
      schema.minimum = definition.minimum;
    }
    if (typeof definition.maximum === "number") {
      schema.maximum = definition.maximum;
    }
  }

  return schema;
}

export function parameterDefinitionsToSchema(
  definitions: RequestParameterDefinition[],
  location: RequestParameterLocation,
): JsonObject {
  const seen = new Set<string>();
  const normalizedDefinitions = definitions.filter((definition) => {
    const trimmedName = definition.name.trim();
    if (!trimmedName || seen.has(trimmedName)) {
      return false;
    }

    seen.add(trimmedName);
    return true;
  });

  return {
    type: "object",
    properties: normalizedDefinitions.reduce<JsonObject>((accumulator, definition) => {
      accumulator[definition.name.trim()] = buildParameterProperty(definition);
      return accumulator;
    }, {}),
    required: normalizedDefinitions
      .filter((definition) => location === "path" || definition.required)
      .map((definition) => definition.name.trim()),
    "x-builder": {
      order: normalizedDefinitions.map((definition) => definition.name.trim()),
    },
  };
}

export function buildRequestSchemaContract(
  bodySchema: JsonObject | null | undefined,
  options: {
    path?: RequestParameterDefinition[];
    query?: RequestParameterDefinition[];
  } = {},
): JsonObject {
  const nextSchema = cloneJsonValue((bodySchema && Object.keys(bodySchema).length > 0 ? bodySchema : {}) as JsonObject);
  const extension: JsonObject = {};

  const pathSchema = parameterDefinitionsToSchema(options.path ?? [], "path");
  if (Object.keys((pathSchema.properties as JsonObject | undefined) ?? {}).length > 0) {
    extension.path = pathSchema;
  }

  const querySchema = parameterDefinitionsToSchema(options.query ?? [], "query");
  if (Object.keys((querySchema.properties as JsonObject | undefined) ?? {}).length > 0) {
    extension.query = querySchema;
  }

  if (Object.keys(extension).length > 0) {
    nextSchema[REQUEST_PARAMETERS_KEY] = extension;
  } else {
    delete nextSchema[REQUEST_PARAMETERS_KEY];
  }

  return nextSchema;
}

export function syncPathParameterDefinitions(
  path: string,
  definitions: RequestParameterDefinition[],
): RequestParameterDefinition[] {
  const parameterNames = extractPathParameters(path);
  const existingByName = new Map(definitions.map((definition) => [definition.name, definition]));

  return parameterNames.map((name, index) => {
    const existing = existingByName.get(name);
    return createRequestParameterDefinition("path", {
      ...existing,
      id: existing?.id ?? `path-${name}-${index}`,
      name,
      required: true,
    });
  });
}

export function validateRequestParameterDefinitions(
  definitions: RequestParameterDefinition[],
  location: RequestParameterLocation,
): string | null {
  const seen = new Set<string>();

  for (const definition of definitions) {
    const trimmedName = definition.name.trim();
    if (!trimmedName) {
      return `Every ${location} parameter needs a name before you can save.`;
    }

    if (seen.has(trimmedName)) {
      return `Duplicate ${location} parameter "${trimmedName}" found.`;
    }

    seen.add(trimmedName);

    if (definition.type === "enum" && definition.enumValues.map((value) => value.trim()).filter(Boolean).length === 0) {
      return `Enum ${location} parameter "${trimmedName}" needs at least one option.`;
    }
  }

  return null;
}

export function buildDefaultParameterValue(definition: RequestParameterDefinition): string {
  if (definition.type === "enum") {
    return definition.enumValues.find((value) => value.trim())?.trim() ?? `sample-${definition.name}`;
  }

  if (definition.type === "integer") {
    if (typeof definition.minimum === "number") {
      return String(Math.trunc(definition.minimum));
    }

    return "1";
  }

  if (definition.type === "number") {
    if (typeof definition.minimum === "number") {
      return String(definition.minimum);
    }

    return "1.5";
  }

  if (definition.type === "boolean") {
    return "true";
  }

  const format = definition.format.trim().toLowerCase();
  const safeName = definition.name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "sample";

  if (format === "uuid") {
    return fitStringPreviewValue("11111111-1111-4111-8111-111111111111", definition);
  }

  if (format === "email") {
    return fitStringPreviewValue(`${safeName}@example.test`, definition);
  }

  if (format === "uri" || format === "url") {
    return fitStringPreviewValue(`https://example.test/${safeName}`, definition);
  }

  if (format === "date") {
    return fitStringPreviewValue("2026-01-01", definition);
  }

  if (format === "date-time") {
    return fitStringPreviewValue("2026-01-01T00:00:00Z", definition);
  }

  if (format === "time") {
    return fitStringPreviewValue("12:00:00Z", definition);
  }

  return fitStringPreviewValue(`sample-${definition.name}`, definition);
}
