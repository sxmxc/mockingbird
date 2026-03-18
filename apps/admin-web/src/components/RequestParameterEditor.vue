<script setup lang="ts">
import { computed } from "vue";
import {
  createRequestParameterDefinition,
  parseOptionalNumberInput,
  type RequestParameterDefinition,
  type RequestParameterLocation,
  type RequestParameterType,
} from "../utils/requestSchema";

const props = defineProps<{
  location: RequestParameterLocation;
  parameters: RequestParameterDefinition[];
  title: string;
  subtitle: string;
}>();

const emit = defineEmits<{
  "update:parameters": [parameters: RequestParameterDefinition[]];
}>();

const typeOptions: Array<{ title: string; value: RequestParameterType }> = [
  { title: "String", value: "string" },
  { title: "Integer", value: "integer" },
  { title: "Number", value: "number" },
  { title: "Boolean", value: "boolean" },
  { title: "Enum", value: "enum" },
];
const stringFormatOptions: Array<{ title: string; value: string }> = [
  { title: "No format", value: "" },
  { title: "UUID", value: "uuid" },
  { title: "Email", value: "email" },
  { title: "URI", value: "uri" },
  { title: "Date", value: "date" },
  { title: "Date time", value: "date-time" },
  { title: "Time", value: "time" },
];

const isPathEditor = computed(() => props.location === "path");

function updateParameters(nextParameters: RequestParameterDefinition[]): void {
  emit("update:parameters", nextParameters);
}

function patchParameter(parameterId: string, patch: Partial<RequestParameterDefinition>): void {
  updateParameters(
    props.parameters.map((parameter) =>
      parameter.id === parameterId
        ? {
            ...parameter,
            ...patch,
          }
        : parameter,
    ),
  );
}

function addQueryParameter(): void {
  updateParameters([...props.parameters, createRequestParameterDefinition("query")]);
}

function removeParameter(parameterId: string): void {
  updateParameters(props.parameters.filter((parameter) => parameter.id !== parameterId));
}

function updateEnumValues(parameterId: string, rawValue: string): void {
  patchParameter(parameterId, {
    enumValues: rawValue
      .split(/\r?\n|,/)
      .map((value) => value.trim())
      .filter(Boolean),
  });
}
</script>

<template>
  <v-card class="workspace-card">
    <v-card-item>
      <v-card-title>{{ title }}</v-card-title>
      <v-card-subtitle>{{ subtitle }}</v-card-subtitle>

      <template #append>
        <v-btn
          v-if="!isPathEditor"
          color="primary"
          density="comfortable"
          prepend-icon="mdi-plus"
          variant="tonal"
          @click="addQueryParameter"
        >
          Add query parameter
        </v-btn>
      </template>
    </v-card-item>

    <v-divider />

    <v-card-text class="d-flex flex-column ga-4">
      <v-alert
        v-if="isPathEditor && parameters.length === 0"
        border="start"
        color="info"
        variant="tonal"
      >
        This route does not currently declare any path placeholders.
      </v-alert>

      <v-alert
        v-else-if="!isPathEditor && parameters.length === 0"
        border="start"
        color="info"
        variant="tonal"
      >
        Add optional query parameters here when the route accepts them.
      </v-alert>

      <v-card
        v-for="parameter in parameters"
        :key="parameter.id"
        class="request-parameter-card"
        variant="outlined"
      >
        <v-card-item>
          <v-card-title class="text-body-1">
            {{ parameter.name || (isPathEditor ? "Path parameter" : "Query parameter") }}
          </v-card-title>

          <template #append>
            <div class="d-flex ga-2">
              <v-chip
                :color="isPathEditor ? 'primary' : parameter.required ? 'accent' : 'secondary'"
                label
                size="small"
                variant="tonal"
              >
                {{ isPathEditor ? "Path" : parameter.required ? "Required" : "Optional" }}
              </v-chip>
              <v-btn
                v-if="!isPathEditor"
                color="error"
                icon="mdi-delete-outline"
                size="small"
                variant="text"
                @click="removeParameter(parameter.id)"
              />
            </div>
          </template>
        </v-card-item>

        <v-divider />

        <v-card-text class="d-flex flex-column ga-4">
          <v-row density="comfortable">
            <v-col cols="12" md="5">
              <v-text-field
                :disabled="isPathEditor"
                label="Parameter name"
                :model-value="parameter.name"
                @update:model-value="patchParameter(parameter.id, { name: String($event ?? '') })"
              />
            </v-col>

            <v-col cols="12" md="4">
              <v-select
                :items="typeOptions"
                item-title="title"
                item-value="value"
                label="Type"
                :model-value="parameter.type"
                @update:model-value="patchParameter(parameter.id, { type: ($event as RequestParameterType | null) ?? 'string' })"
              />
            </v-col>

            <v-col cols="12" md="3">
              <v-switch
                v-if="!isPathEditor"
                color="accent"
                hide-details
                inset
                label="Required"
                :model-value="parameter.required"
                @update:model-value="patchParameter(parameter.id, { required: Boolean($event) })"
              />
            </v-col>
          </v-row>

          <v-textarea
            auto-grow
            label="Description"
            :model-value="parameter.description"
            rows="2"
            @update:model-value="patchParameter(parameter.id, { description: String($event ?? '') })"
          />

          <v-row v-if="parameter.type === 'string'">
            <v-col cols="12" md="4">
              <v-select
                :items="stringFormatOptions"
                item-title="title"
                item-value="value"
                label="Format"
                :model-value="parameter.format"
                @update:model-value="patchParameter(parameter.id, { format: String($event ?? '') })"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                label="Min length"
                :model-value="parameter.minLength ?? ''"
                type="number"
                @update:model-value="patchParameter(parameter.id, { minLength: parseOptionalNumberInput($event) })"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                label="Max length"
                :model-value="parameter.maxLength ?? ''"
                type="number"
                @update:model-value="patchParameter(parameter.id, { maxLength: parseOptionalNumberInput($event) })"
              />
            </v-col>
          </v-row>

          <v-row v-if="parameter.type === 'integer' || parameter.type === 'number'">
            <v-col cols="12" md="6">
              <v-text-field
                label="Minimum"
                :model-value="parameter.minimum ?? ''"
                type="number"
                @update:model-value="patchParameter(parameter.id, { minimum: parseOptionalNumberInput($event) })"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                label="Maximum"
                :model-value="parameter.maximum ?? ''"
                type="number"
                @update:model-value="patchParameter(parameter.id, { maximum: parseOptionalNumberInput($event) })"
              />
            </v-col>
          </v-row>

          <v-textarea
            v-if="parameter.type === 'enum'"
            auto-grow
            label="Enum options"
            :model-value="parameter.enumValues.join('\n')"
            rows="4"
            @update:model-value="updateEnumValues(parameter.id, String($event ?? ''))"
          />
        </v-card-text>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.request-parameter-card {
  overflow: hidden;
}
</style>
