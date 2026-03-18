<script setup lang="ts">
import { computed, ref } from "vue";
import { PALETTE_TYPES, isScalarNode, nodeLabel, valueTypeLabel, type BuilderNodeType, type BuilderScope, type SchemaBuilderNode } from "../schemaBuilder";
import { setPillDragImage } from "../utils/dragGhost";

const props = withDefaults(defineProps<{
  activeNodeId: string;
  collapsedNodeIds?: string[];
  node: SchemaBuilderNode;
  parentId: string | null;
  parentType: BuilderNodeType | null;
  root?: boolean;
  scope: BuilderScope;
}>(), {
  collapsedNodeIds: () => [],
});

const emit = defineEmits<{
  dropContainer: [containerId: string];
  dropRow: [nodeId: string];
  dropValue: [nodeId: string];
  insertNode: [targetId: string, placement: "before" | "container", nodeType: BuilderNodeType];
  select: [nodeId: string];
  startDrag: [nodeId: string, event?: DragEvent];
  toggleCollapse: [nodeId: string];
}>();

const isRowOver = ref(false);
const isTailOver = ref(false);
const isValueOver = ref(false);
const rowMenuOpen = ref(false);
const tailMenuOpen = ref(false);

const isSelected = computed(() => props.activeNodeId === props.node.id);
const hasValueLane = computed(() => props.scope === "response" && isScalarNode(props.node));
const isCollapsible = computed(() => !props.root && (props.node.type === "object" || props.node.type === "array"));
const isCollapsed = computed(() => props.collapsedNodeIds.includes(props.node.id));
const collapsedSummary = computed(() => {
  if (!isCollapsible.value || !isCollapsed.value) {
    return null;
  }

  if (props.node.type === "array") {
    return props.node.item ? "Item shape hidden" : "Empty array";
  }

  const childCount = props.node.children.length;
  if (childCount === 0) {
    return "Empty object";
  }

  return childCount === 1 ? "1 field hidden" : `${childCount} fields hidden`;
});
const nodeSummary = computed(() => props.node.description || (props.root ? "Top-level schema" : `${props.node.type} field`));
const nodeIcon = computed(() => {
  switch (props.node.type) {
    case "array":
      return "mdi-code-brackets";
    case "boolean":
      return "mdi-toggle-switch-outline";
    case "enum":
      return "mdi-format-list-bulleted-square";
    case "integer":
      return "mdi-pound";
    case "number":
      return "mdi-decimal";
    case "object":
      return "mdi-code-braces";
    case "string":
    default:
      return "mdi-format-letter-case";
  }
});
const rowInsertTitle = computed(() => `Insert or move a field before ${nodeLabel(props.node, Boolean(props.root)).toLowerCase()}`);
const tailInsertTitle = computed(() => {
  if (props.node.type === "array") {
    return props.node.item ? "Replace the array item shape" : "Set the array item shape";
  }

  return props.node.children.length ? `Add a field to the end of ${nodeLabel(props.node, Boolean(props.root)).toLowerCase()}` : "Add the first field";
});
const valueDropTitle = computed(() => `Set the response value for ${nodeLabel(props.node, Boolean(props.root)).toLowerCase()}`);
const valueModeLabel = computed(() => {
  if (props.node.parameterSource) {
    return "Route";
  }

  if (props.node.mode === "fixed") {
    return "Static";
  }

  if (props.node.mode === "mocking") {
    return "Mocking";
  }

  return "Random";
});
const valueSlotLabel = computed(() => (
  props.node.parameterSource
    ? props.node.parameterSource
    : props.node.mode === "fixed"
      ? "Fixed value"
      : valueTypeLabel(props.node.generator)
));
const valueModeClass = computed(() => `schema-value-slot-${props.node.parameterSource ? "parameter" : props.node.mode}`);
const insertOptions = computed(() => PALETTE_TYPES.map((item) => ({
  ...item,
  icon: paletteIconByType[item.type],
})));

const paletteIconByType: Record<BuilderNodeType, string> = {
  array: "mdi-code-brackets",
  boolean: "mdi-toggle-switch-outline",
  enum: "mdi-format-list-bulleted-square",
  integer: "mdi-pound",
  number: "mdi-decimal",
  object: "mdi-code-braces",
  string: "mdi-format-letter-case",
};

function startDrag(event: DragEvent): void {
  if (props.root) {
    return;
  }

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.dropEffect = "move";
    event.dataTransfer.setData("text/plain", props.node.id);
  }

  const source = event.currentTarget;
  if (source instanceof HTMLElement) {
    source.classList.add("schema-node-pill-drag-source");
    source.addEventListener("dragend", () => {
      source.classList.remove("schema-node-pill-drag-source");
    }, { once: true });
  }

  setPillDragImage(event, {
    eyebrow: props.node.type,
    label: nodeLabel(props.node, Boolean(props.root)),
    tone: "node",
  });

  emit("startDrag", props.node.id, event);
}

function dropOnContainer(): void {
  isTailOver.value = false;
  emit("dropContainer", props.node.id);
}

function dropOnRow(): void {
  isRowOver.value = false;
  emit("dropRow", props.node.id);
}

function dropOnValue(): void {
  isValueOver.value = false;
  emit("dropValue", props.node.id);
}

function forwardStartDrag(nodeId: string, event?: DragEvent): void {
  emit("startDrag", nodeId, event);
}

function insertFromMenu(placement: "before" | "container", nodeType: BuilderNodeType): void {
  if (placement === "before") {
    rowMenuOpen.value = false;
  } else {
    tailMenuOpen.value = false;
  }

  emit("insertNode", props.node.id, placement, nodeType);
}

function toggleCollapsed(): void {
  if (!isCollapsible.value) {
    return;
  }

  emit("toggleCollapse", props.node.id);
}
</script>

<template>
  <div class="schema-tree-node" :class="{ 'schema-tree-node-branch': !root, 'schema-tree-node-root': root }">
    <div
      v-if="!root && parentType === 'object'"
      class="schema-insert-anchor-slot schema-insert-anchor-slot-top"
      :class="{ 'schema-insert-anchor-slot-active': isRowOver || rowMenuOpen }"
    >
      <v-menu v-model="rowMenuOpen" location="end center">
        <template #activator="{ props: menuProps }">
          <button
            v-bind="menuProps"
            class="schema-insert-anchor schema-insert-anchor-key"
            :class="{ 'schema-insert-anchor-active': isRowOver || rowMenuOpen }"
            :aria-label="rowInsertTitle"
            :title="rowInsertTitle"
            data-drop-zone="row"
            :data-drop-target="node.id"
            data-insert-menu="row"
            :data-insert-target="node.id"
            type="button"
            @click.stop
            @dragenter.prevent="isRowOver = true"
            @dragleave.prevent="isRowOver = false"
            @dragover.prevent
            @drop.prevent="dropOnRow"
          >
            <v-icon icon="mdi-plus" size="16" />
          </button>
        </template>

        <v-list density="compact" nav>
          <v-list-subheader>Add before this field</v-list-subheader>
          <v-list-item
            v-for="option in insertOptions"
            :key="`before-${node.id}-${option.type}`"
            :data-insert-placement="'before'"
            :data-insert-type="option.type"
            @click="insertFromMenu('before', option.type)"
          >
            <template #prepend>
              <v-icon :icon="option.icon" size="18" />
            </template>
            <v-list-item-title>{{ option.label }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <div class="schema-tree-row" :class="{ 'schema-tree-row-selected': isSelected, 'schema-tree-row-root': root }">
      <button
        v-if="!root"
        class="schema-node-drag-handle"
        :data-node-drag-handle="node.id"
        :aria-label="`Drag ${nodeLabel(node, Boolean(root))}`"
        :title="`Drag ${nodeLabel(node, Boolean(root))}`"
        :draggable="true"
        type="button"
        @dragstart.stop="startDrag"
      >
        <v-icon icon="mdi-drag" size="16" />
      </button>

      <button
        v-if="isCollapsible"
        class="schema-node-collapse-toggle"
        :aria-label="isCollapsed ? `Expand ${nodeLabel(node, Boolean(root))}` : `Collapse ${nodeLabel(node, Boolean(root))}`"
        :data-collapse-toggle="node.id"
        type="button"
        @click.stop="toggleCollapsed"
      >
        <v-icon :icon="isCollapsed ? 'mdi-chevron-right' : 'mdi-chevron-down'" size="18" />
      </button>

      <button
        class="schema-node-pill"
        :class="{ 'schema-node-pill-root': root, 'schema-node-pill-selected': isSelected }"
        :data-node-id="node.id"
        :title="nodeSummary"
        type="button"
        @click.stop="emit('select', node.id)"
      >
        <span class="schema-node-pill-icon">
          <v-icon :icon="nodeIcon" size="16" />
        </span>
        <span class="schema-node-pill-label">
          {{ nodeLabel(node, Boolean(root)) }}
        </span>
      </button>

      <v-chip class="schema-node-kind-pill" label size="small" variant="tonal">
        {{ node.type }}
      </v-chip>

      <v-chip
        v-if="collapsedSummary"
        class="schema-node-collapsed-pill"
        label
        size="small"
        variant="outlined"
      >
        {{ collapsedSummary }}
      </v-chip>

      <v-chip
        v-if="isSelected"
        class="schema-node-selected-pill"
        color="warning"
        label
        size="small"
        variant="tonal"
      >
        selected
      </v-chip>

      <button
        v-if="hasValueLane"
        class="schema-value-slot"
        :class="[valueModeClass, { 'schema-value-slot-active': isValueOver }]"
        :aria-label="valueDropTitle"
        :title="valueDropTitle"
        data-drop-zone="value"
        :data-drop-target="node.id"
        type="button"
        @dragenter.prevent="isValueOver = true"
        @dragleave.prevent="isValueOver = false"
        @dragover.prevent
        @drop.prevent="dropOnValue"
      >
        <span class="schema-value-slot-mode">{{ valueModeLabel }}</span>
        <span class="schema-value-slot-label">{{ valueSlotLabel }}</span>
      </button>

      <v-chip v-if="!root && node.required" class="schema-node-required-pill" color="accent" label size="small" variant="tonal">
        required
      </v-chip>
    </div>

    <div v-if="node.type === 'object' && !isCollapsed" class="schema-tree-children">
      <SchemaNodeCard
        v-for="child in node.children"
        :key="child.id"
        :active-node-id="activeNodeId"
        :collapsed-node-ids="collapsedNodeIds"
        :node="child"
        :parent-id="node.id"
        :parent-type="node.type"
        :scope="scope"
        @insert-node="(targetId, placement, nodeType) => emit('insertNode', targetId, placement, nodeType)"
        @drop-container="emit('dropContainer', $event)"
        @drop-row="emit('dropRow', $event)"
        @drop-value="emit('dropValue', $event)"
        @select="emit('select', $event)"
        @start-drag="forwardStartDrag"
        @toggle-collapse="emit('toggleCollapse', $event)"
      />

      <div
        class="schema-insert-anchor-slot schema-insert-anchor-slot-bottom"
        :class="{ 'schema-insert-anchor-slot-active': isTailOver || tailMenuOpen }"
      >
        <v-menu v-model="tailMenuOpen" location="end center">
          <template #activator="{ props: menuProps }">
            <button
              v-bind="menuProps"
              class="schema-insert-anchor schema-insert-anchor-key"
              :class="{ 'schema-insert-anchor-active': isTailOver || tailMenuOpen }"
              :aria-label="tailInsertTitle"
              :title="tailInsertTitle"
              data-drop-zone="container"
              :data-drop-target="node.id"
              data-insert-menu="container"
              :data-insert-target="node.id"
              type="button"
              @click.stop
              @dragenter.prevent="isTailOver = true"
              @dragleave.prevent="isTailOver = false"
              @dragover.prevent
              @drop.prevent="dropOnContainer"
            >
              <v-icon icon="mdi-plus" size="16" />
            </button>
          </template>

          <v-list density="compact" nav>
            <v-list-subheader>Add to this level</v-list-subheader>
            <v-list-item
              v-for="option in insertOptions"
              :key="`container-${node.id}-${option.type}`"
              :data-insert-placement="'container'"
              :data-insert-type="option.type"
              @click="insertFromMenu('container', option.type)"
            >
              <template #prepend>
                <v-icon :icon="option.icon" size="18" />
              </template>
              <v-list-item-title>{{ option.label }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </div>

    <div v-else-if="node.type === 'array' && !isCollapsed" class="schema-tree-children schema-tree-children-array">
      <SchemaNodeCard
        v-if="node.item"
        :active-node-id="activeNodeId"
        :collapsed-node-ids="collapsedNodeIds"
        :node="node.item"
        :parent-id="node.id"
        :parent-type="node.type"
        :scope="scope"
        @insert-node="(targetId, placement, nodeType) => emit('insertNode', targetId, placement, nodeType)"
        @drop-container="emit('dropContainer', $event)"
        @drop-row="emit('dropRow', $event)"
        @drop-value="emit('dropValue', $event)"
        @select="emit('select', $event)"
        @start-drag="forwardStartDrag"
        @toggle-collapse="emit('toggleCollapse', $event)"
      />

      <div
        class="schema-insert-anchor-slot schema-insert-anchor-slot-bottom"
        :class="{ 'schema-insert-anchor-slot-active': isTailOver || tailMenuOpen }"
      >
        <v-menu v-model="tailMenuOpen" location="end center">
          <template #activator="{ props: menuProps }">
            <button
              v-bind="menuProps"
              class="schema-insert-anchor schema-insert-anchor-key"
              :class="{ 'schema-insert-anchor-active': isTailOver || tailMenuOpen }"
              :aria-label="tailInsertTitle"
              :title="tailInsertTitle"
              data-drop-zone="container"
              :data-drop-target="node.id"
              data-insert-menu="container"
              :data-insert-target="node.id"
              type="button"
              @click.stop
              @dragenter.prevent="isTailOver = true"
              @dragleave.prevent="isTailOver = false"
              @dragover.prevent
              @drop.prevent="dropOnContainer"
            >
              <v-icon icon="mdi-plus" size="16" />
            </button>
          </template>

          <v-list density="compact" nav>
            <v-list-subheader>Set item shape</v-list-subheader>
            <v-list-item
              v-for="option in insertOptions"
              :key="`array-${node.id}-${option.type}`"
              :data-insert-placement="'container'"
              :data-insert-type="option.type"
              @click="insertFromMenu('container', option.type)"
            >
              <template #prepend>
                <v-icon :icon="option.icon" size="18" />
              </template>
              <v-list-item-title>{{ option.label }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </div>
  </div>
</template>
