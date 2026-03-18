<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { AdminApiError, getEndpoint, previewResponse } from "../api/admin";
import { useAuth } from "../composables/useAuth";
import type { Endpoint } from "../types/endpoints";
import {
  buildDefaultParameterValue,
  extractRequestParameterDefinitions,
  syncPathParameterDefinitions,
  type RequestParameterDefinition,
} from "../utils/requestSchema";
import { buildDefaultPathParameters, resolvePathParameters } from "../utils/pathParameters";

const route = useRoute();
const router = useRouter();
const auth = useAuth();

const endpoint = ref<Endpoint | null>(null);
const pathParameters = ref<Record<string, string>>({});
const queryParameters = ref<Record<string, string>>({});
const requestBody = ref("{}");
const samplePreview = ref<string | null>(null);
const previewResult = ref<{
  body: string;
  contentType: string;
  status: number;
  statusText: string;
} | null>(null);
const isLoading = ref(true);
const isRunning = ref(false);
const loadError = ref<string | null>(null);
const previewError = ref<string | null>(null);

const endpointId = computed(() => {
  const rawId = route.params.endpointId;
  return typeof rawId === "string" ? Number(rawId) : null;
});
const pathParameterDefinitions = computed<RequestParameterDefinition[]>(() =>
  endpoint.value
    ? syncPathParameterDefinitions(
        endpoint.value.path,
        extractRequestParameterDefinitions(endpoint.value.request_schema ?? {}, "path"),
      )
    : [],
);
const queryParameterDefinitions = computed<RequestParameterDefinition[]>(() =>
  endpoint.value ? extractRequestParameterDefinitions(endpoint.value.request_schema ?? {}, "query") : [],
);
const canWriteRoutes = computed(() => auth.canWriteRoutes.value && !auth.mustChangePassword.value);

function buildDefaultQueryParameterValues(parameters: RequestParameterDefinition[]): Record<string, string> {
  return parameters.reduce<Record<string, string>>((accumulator, parameter) => {
    accumulator[parameter.name] = "";
    return accumulator;
  }, {});
}

watch(
  endpointId,
  () => {
    void loadEndpoint();
  },
  { immediate: true },
);

watch(endpoint, () => {
  if (endpoint.value) {
    void loadSamplePreview();
  }
});

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function loadEndpoint(): Promise<void> {
  if (!endpointId.value || !auth.session.value) {
    isLoading.value = false;
    loadError.value = "Missing endpoint id.";
    return;
  }

  isLoading.value = true;
  loadError.value = null;

  try {
    const loadedEndpoint = await getEndpoint(endpointId.value, auth.session.value);
    endpoint.value = loadedEndpoint;
    pathParameters.value = pathParameterDefinitions.value.reduce<Record<string, string>>((accumulator, parameter) => {
      accumulator[parameter.name] = buildDefaultParameterValue(parameter);
      return accumulator;
    }, buildDefaultPathParameters(loadedEndpoint.path));
    queryParameters.value = buildDefaultQueryParameterValues(queryParameterDefinitions.value);
    requestBody.value = "{}";
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      void auth.logout("Your admin session expired. Sign in again before previewing endpoints.");
      void router.push({ name: "login" });
      return;
    }

    loadError.value = error instanceof Error ? error.message : "Unable to load the endpoint preview.";
  } finally {
    isLoading.value = false;
  }
}

async function loadSamplePreview(): Promise<void> {
  if (!endpoint.value || !auth.session.value) {
    return;
  }

  try {
    const response = await previewResponse(
      endpoint.value.response_schema ?? {},
      endpoint.value.seed_key ?? null,
      pathParameters.value,
      auth.session.value,
    );
    samplePreview.value = prettyJson(response.preview);
  } catch {
    samplePreview.value = null;
  }
}

async function runPreview(): Promise<void> {
  if (!endpoint.value) {
    return;
  }

  previewError.value = null;
  previewResult.value = null;
  isRunning.value = true;

  try {
    let body: string | undefined;
    const queryString = new URLSearchParams(
      Object.entries(queryParameters.value).filter(([, value]) => String(value ?? "").trim()),
    ).toString();

    if (!["GET", "DELETE"].includes(endpoint.value.method) && requestBody.value.trim()) {
      try {
        JSON.parse(requestBody.value);
        body = requestBody.value;
      } catch {
        previewError.value = "Request body must be valid JSON before running the preview.";
        isRunning.value = false;
        return;
      }
    }

    const requestPath = resolvePathParameters(endpoint.value.path, pathParameters.value);
    const response = await fetch(queryString ? `${requestPath}?${queryString}` : requestPath, {
      method: endpoint.value.method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    });
    const responseText = await response.text();

    let renderedBody = responseText;
    try {
      renderedBody = prettyJson(JSON.parse(responseText));
    } catch {
      if (!responseText) {
        renderedBody = "(empty response)";
      }
    }

    previewResult.value = {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type") ?? "unknown",
      body: renderedBody,
    };
  } catch (error) {
    previewError.value = error instanceof Error ? error.message : "Unable to run the preview.";
  } finally {
    isRunning.value = false;
  }
}
</script>

<template>
  <div class="d-flex flex-column ga-4">
    <div class="d-flex flex-column flex-lg-row justify-space-between ga-4">
      <div>
        <div class="text-overline text-secondary">Test route</div>
        <div class="text-h3 font-weight-bold mt-2">{{ endpoint?.name || "Loading route" }}</div>
        <div class="text-body-1 text-medium-emphasis mt-3">
          Send sample input and inspect the live response for this route.
        </div>
      </div>

      <div class="d-flex flex-wrap align-start justify-end ga-2">
        <v-btn
          prepend-icon="mdi-arrow-left"
          variant="text"
          @click="router.push({ name: canWriteRoutes ? (endpoint ? 'endpoints-edit' : 'endpoints-browse') : 'endpoints-browse', params: canWriteRoutes && endpoint ? { endpointId: endpoint.id } : undefined })"
        >
          {{ canWriteRoutes ? "Back to route" : "Back to routes" }}
        </v-btn>
        <v-btn
          v-if="endpoint && canWriteRoutes"
          prepend-icon="mdi-shape-outline"
          variant="text"
          @click="router.push({ name: 'schema-editor', params: { endpointId: endpoint.id } })"
        >
          Edit schema
        </v-btn>
      </div>
    </div>

    <v-skeleton-loader
      v-if="isLoading"
      class="workspace-card"
      type="heading, paragraph, paragraph, table-heading, table-row-divider, paragraph"
    />

    <v-card v-else-if="!endpoint" class="workspace-card">
      <v-card-text class="pa-8">
        <div class="text-overline text-error">Preview unavailable</div>
        <div class="text-h4 font-weight-bold mt-2">We could not load that endpoint.</div>
        <div class="text-body-1 text-medium-emphasis mt-4">
          {{ loadError ?? "The endpoint is missing or your session changed while loading the preview." }}
        </div>
      </v-card-text>
    </v-card>

    <template v-else>
      <v-card class="workspace-card">
        <v-card-text class="d-flex flex-wrap justify-space-between ga-3">
          <div class="d-flex flex-wrap ga-2">
            <v-chip color="primary" label size="small" variant="tonal">{{ endpoint.method }}</v-chip>
            <v-chip :color="endpoint.enabled ? 'accent' : 'error'" label size="small" variant="tonal">
              {{ endpoint.enabled ? "Live" : "Disabled" }}
            </v-chip>
            <v-chip label size="small" variant="outlined">{{ endpoint.path }}</v-chip>
          </div>
          <v-btn color="primary" :loading="isRunning" prepend-icon="mdi-play-circle-outline" @click="runPreview">
            Send request
          </v-btn>
        </v-card-text>
      </v-card>

      <v-alert v-if="!endpoint.enabled" border="start" color="info" variant="tonal">
        This route is disabled, so this request should return a 404.
      </v-alert>

      <v-alert v-if="previewError" border="start" color="error" variant="tonal">
        {{ previewError }}
      </v-alert>

      <v-row density="comfortable">
        <v-col cols="12" lg="5">
          <v-card class="workspace-card fill-height">
            <v-card-item>
              <v-card-title>Request</v-card-title>
              <v-card-subtitle>Set path/query values and send a JSON body when this route uses one.</v-card-subtitle>
            </v-card-item>
            <v-divider />
            <v-card-text class="d-flex flex-column ga-4">
              <v-text-field
                v-for="parameter in pathParameterDefinitions"
                :key="parameter.name"
                v-model="pathParameters[parameter.name]"
                :hint="parameter.description || undefined"
                :label="`Path parameter: ${parameter.name}`"
                persistent-hint
              />

              <v-text-field
                v-for="parameter in queryParameterDefinitions"
                :key="parameter.name"
                v-model="queryParameters[parameter.name]"
                :hint="parameter.description || undefined"
                :label="`Query parameter: ${parameter.name}`"
                persistent-hint
              />

              <v-textarea
                v-if="!['GET', 'DELETE'].includes(endpoint.method)"
                v-model="requestBody"
                auto-grow
                label="Request body"
                rows="10"
              />

              <div v-if="samplePreview" class="d-flex flex-column ga-2">
                <div class="text-overline text-medium-emphasis">Sample response</div>
                <pre class="code-block">{{ samplePreview }}</pre>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" lg="7">
          <v-card class="workspace-card fill-height">
            <v-card-item>
              <v-card-title>Response</v-card-title>
              <v-card-subtitle>
                {{
                  previewResult
                    ? `${previewResult.status} ${previewResult.statusText} • ${previewResult.contentType}`
                    : "Send the request to inspect the live response."
                }}
              </v-card-subtitle>
            </v-card-item>
            <v-divider />
            <v-card-text>
              <pre class="code-block">{{ previewResult?.body ?? "(send the request to see the response body)" }}</pre>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </div>
</template>
