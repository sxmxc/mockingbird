<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  AdminApiError,
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser,
} from "../api/admin";
import { useAuth } from "../composables/useAuth";
import type { AdminUser } from "../types/endpoints";
import { roleLabel } from "../utils/adminAccess";

const auth = useAuth();
const router = useRouter();

const users = ref<AdminUser[]>([]);
const usersLoading = ref(false);
const usersError = ref<string | null>(null);
const usersSuccess = ref<string | null>(null);
const searchQuery = ref("");
const roleFilter = ref<AdminUser["role"] | "all">("all");
const statusFilter = ref<"all" | "active" | "disabled">("all");

const createDialog = ref(false);
const createForm = reactive({
  fullName: "",
  email: "",
  avatarUrl: "",
  username: "",
  password: "",
  isActive: true,
  role: "editor" as AdminUser["role"],
  mustChangePassword: true,
});
const createBusy = ref(false);
const createError = ref<string | null>(null);

const editDialog = ref(false);
const editBusy = ref(false);
const editError = ref<string | null>(null);
const editForm = reactive({
  id: 0,
  fullName: "",
  email: "",
  avatarUrl: "",
  username: "",
  password: "",
  isActive: true,
  role: "editor" as AdminUser["role"],
  mustChangePassword: false,
});

const currentUserId = computed(() => auth.user.value?.id ?? null);
const canManageUsers = computed(() => auth.canManageUsers.value && !auth.mustChangePassword.value);
const isEditingCurrentUser = computed(() => editForm.id === currentUserId.value);
const roleOptions: Array<{ title: string; value: AdminUser["role"] }> = [
  { title: "Viewer", value: "viewer" },
  { title: "Editor", value: "editor" },
  { title: "Superuser", value: "superuser" },
];
const roleFilterOptions: Array<{ title: string; value: AdminUser["role"] | "all" }> = [
  { title: "All roles", value: "all" },
  ...roleOptions,
];
const statusFilterOptions = [
  { title: "Any status", value: "all" },
  { title: "Active only", value: "active" },
  { title: "Disabled only", value: "disabled" },
] as const;
const filteredUsers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return users.value.filter((user) => {
    const matchesQuery = !query || [user.full_name, user.username, user.email, roleLabel(user.role)].some((value) =>
      value?.toLowerCase().includes(query),
    );
    const matchesRole = roleFilter.value === "all" || user.role === roleFilter.value;
    const matchesStatus = statusFilter.value === "all" ||
      (statusFilter.value === "active" ? user.is_active : !user.is_active);

    return matchesQuery && matchesRole && matchesStatus;
  });
});
const activeEditUser = computed(() => users.value.find((user) => user.id === editForm.id) ?? null);
const summaryChips = computed(() => ({
  active: users.value.filter((user) => user.is_active).length,
  resetRequired: users.value.filter((user) => user.must_change_password).length,
  superusers: users.value.filter((user) => user.role === "superuser").length,
  total: users.value.length,
}));
const summaryCards = computed(() => [
  {
    color: "primary",
    helper: "All dashboard accounts",
    icon: "mdi-account-group-outline",
    title: "Total accounts",
    value: summaryChips.value.total,
  },
  {
    color: "accent",
    helper: "Can sign in today",
    icon: "mdi-check-decagram-outline",
    title: "Active",
    value: summaryChips.value.active,
  },
  {
    color: "warning",
    helper: "Need password rotation",
    icon: "mdi-lock-reset",
    title: "Password resets",
    value: summaryChips.value.resetRequired,
  },
  {
    color: "secondary",
    helper: "Full admin control",
    icon: "mdi-shield-crown-outline",
    title: "Superusers",
    value: summaryChips.value.superusers,
  },
]);
const filteredUsersSummary = computed(() => {
  if (!users.value.length) {
    return "No admin users yet";
  }

  if (!searchQuery.value.trim() && roleFilter.value === "all" && statusFilter.value === "all") {
    return `${users.value.length} users in the directory`;
  }

  return `Showing ${filteredUsers.value.length} of ${users.value.length} users`;
});

function roleSummary(role: AdminUser["role"]): string {
  if (role === "superuser") {
    return "Full route access plus admin-user management.";
  }

  if (role === "editor") {
    return "Can create, edit, import, delete, and preview routes.";
  }

  return "Can browse the route catalog and run previews only.";
}

function describeError(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Not available yet";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function normalizeOptionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function resetCreateForm(): void {
  createForm.fullName = "";
  createForm.email = "";
  createForm.avatarUrl = "";
  createForm.username = "";
  createForm.password = "";
  createForm.isActive = true;
  createForm.role = "editor";
  createForm.mustChangePassword = true;
}

function openCreateDialog(): void {
  createError.value = null;
  resetCreateForm();
  createDialog.value = true;
}

function closeCreateDialog(): void {
  createDialog.value = false;
  createError.value = null;
}

function handleExpiredSession(error: unknown, message: string): boolean {
  if (error instanceof AdminApiError && error.status === 401) {
    void auth.logout(message);
    void router.push({ name: "login" });
    return true;
  }

  return false;
}

async function loadUsers(): Promise<void> {
  if (!auth.session.value || !canManageUsers.value) {
    users.value = [];
    usersError.value = null;
    return;
  }

  usersLoading.value = true;
  usersError.value = null;

  try {
    users.value = await listAdminUsers(auth.session.value);
  } catch (error) {
    if (handleExpiredSession(error, "Your admin session expired. Sign in again before managing users.")) {
      return;
    }

    usersError.value = describeError(error, "Unable to load admin users.");
  } finally {
    usersLoading.value = false;
  }
}

watch(
  () => [auth.session.value?.token, canManageUsers.value],
  () => {
    void loadUsers();
  },
  { immediate: true },
);

async function submitCreateUser(): Promise<void> {
  if (!auth.session.value) {
    createError.value = "Sign in again before creating users.";
    return;
  }

  createError.value = null;
  usersSuccess.value = null;

  if (!createForm.username.trim() || !createForm.password) {
    createError.value = "Enter both a username and an initial password.";
    return;
  }

  createBusy.value = true;

  try {
    await createAdminUser(
      {
        full_name: normalizeOptionalText(createForm.fullName),
        email: normalizeOptionalText(createForm.email),
        avatar_url: normalizeOptionalText(createForm.avatarUrl),
        username: createForm.username.trim(),
        password: createForm.password,
        is_active: createForm.isActive,
        role: createForm.role,
        must_change_password: createForm.mustChangePassword,
      },
      auth.session.value,
    );
    closeCreateDialog();
    resetCreateForm();
    usersSuccess.value = "Created the new admin user.";
    await loadUsers();
  } catch (error) {
    if (handleExpiredSession(error, "Your admin session expired. Sign in again before creating users.")) {
      return;
    }

    createError.value = describeError(error, "Unable to create the admin user.");
  } finally {
    createBusy.value = false;
  }
}

function openEditDialog(user: AdminUser): void {
  editError.value = null;
  editForm.id = user.id;
  editForm.fullName = user.full_name ?? "";
  editForm.email = user.email ?? "";
  editForm.avatarUrl = user.avatar_url ?? "";
  editForm.username = user.username;
  editForm.password = "";
  editForm.isActive = user.is_active;
  editForm.role = user.role;
  editForm.mustChangePassword = user.must_change_password;
  editDialog.value = true;
}

async function submitUserUpdate(): Promise<void> {
  if (!auth.session.value) {
    editError.value = "Sign in again before saving user changes.";
    return;
  }

  editError.value = null;
  usersSuccess.value = null;
  editBusy.value = true;

  try {
    const updatedUser = await updateAdminUser(
      editForm.id,
      {
        full_name: normalizeOptionalText(editForm.fullName),
        email: normalizeOptionalText(editForm.email),
        avatar_url: normalizeOptionalText(editForm.avatarUrl),
        username: editForm.username.trim(),
        password: editForm.password.trim() || undefined,
        is_active: editForm.isActive,
        role: editForm.role,
        must_change_password: editForm.mustChangePassword,
      },
      auth.session.value,
    );
    if (updatedUser.id === currentUserId.value) {
      auth.updateCurrentUser(updatedUser);
    }
    editDialog.value = false;
    usersSuccess.value = `Saved ${updatedUser.username}.`;
    await loadUsers();
  } catch (error) {
    if (handleExpiredSession(error, "Your admin session expired. Sign in again before saving user changes.")) {
      return;
    }

    editError.value = describeError(error, "Unable to save the admin user.");
  } finally {
    editBusy.value = false;
  }
}

async function removeUser(): Promise<void> {
  if (!auth.session.value) {
    editError.value = "Sign in again before deleting users.";
    return;
  }

  const targetUser = users.value.find((user) => user.id === editForm.id);
  if (!targetUser) {
    editError.value = "Select a user before deleting.";
    return;
  }

  const shouldDelete = window.confirm(`Delete "${targetUser.username}" from admin access?`);
  if (!shouldDelete) {
    return;
  }

  editBusy.value = true;
  editError.value = null;

  try {
    await deleteAdminUser(targetUser.id, auth.session.value);
    editDialog.value = false;
    usersSuccess.value = `Deleted ${targetUser.username}.`;
    await loadUsers();
  } catch (error) {
    if (handleExpiredSession(error, "Your admin session expired. Sign in again before deleting users.")) {
      return;
    }

    editError.value = describeError(error, "Unable to delete the admin user.");
  } finally {
    editBusy.value = false;
  }
}
</script>

<template>
  <div class="users-page d-flex flex-column ga-5">
    <section class="users-hero">
      <div class="users-hero__copy">
        <div class="users-hero__eyebrow">Access control</div>
        <h1 class="users-hero__title">Users</h1>
        <p class="users-hero__body">
          Manage dashboard access, roles, and password reset state without mixing account administration into personal profile settings.
        </p>
      </div>

      <div class="users-hero__actions">
        <v-btn
          prepend-icon="mdi-refresh"
          rounded="xl"
          variant="text"
          :loading="usersLoading"
          @click="void loadUsers()"
        >
          Refresh
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-account-plus-outline"
          rounded="xl"
          :disabled="!canManageUsers"
          @click="openCreateDialog"
        >
          New user
        </v-btn>
      </div>
    </section>

    <v-alert v-if="usersSuccess" border="start" closable color="success" variant="tonal" @click:close="usersSuccess = null">
      {{ usersSuccess }}
    </v-alert>

    <v-alert v-if="usersError" border="start" closable color="error" variant="tonal" @click:close="usersError = null">
      {{ usersError }}
    </v-alert>

    <v-alert v-if="!canManageUsers" border="start" color="info" variant="tonal">
      Only superusers can manage admin users.
    </v-alert>

    <v-row class="workspace-grid users-summary-grid">
      <v-col v-for="card in summaryCards" :key="card.title" cols="12" sm="6" xl="3" lg="6">
        <v-card class="workspace-card users-stat-card">
          <v-card-text class="users-stat-card__body">
            <div class="users-stat-card__copy">
              <div class="users-stat-card__label">{{ card.title }}</div>
              <div class="users-stat-card__value">{{ card.value }}</div>
              <div class="users-stat-card__helper">{{ card.helper }}</div>
            </div>
            <v-avatar :color="card.color" class="users-stat-card__icon" size="42" variant="tonal">
              <v-icon :icon="card.icon" />
            </v-avatar>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-card class="workspace-card users-directory-card">
      <v-card-item class="users-directory-card__header">
        <template #prepend>
          <v-avatar color="info" variant="tonal">
            <v-icon icon="mdi-account-group-outline" />
          </v-avatar>
        </template>

        <v-card-title>User directory</v-card-title>
        <v-card-subtitle>Search, filter, and review dashboard access in one place.</v-card-subtitle>
      </v-card-item>

      <v-divider />

      <v-card-text class="d-flex flex-column ga-4">
        <div class="users-directory-toolbar">
          <v-text-field
            v-model="searchQuery"
            class="users-directory-toolbar__search"
            clearable
            hide-details
            label="Search users"
            prepend-inner-icon="mdi-magnify"
          />
          <v-select
            v-model="roleFilter"
            :items="roleFilterOptions"
            class="users-directory-toolbar__filter"
            hide-details
            item-title="title"
            item-value="value"
            label="Role"
          />
          <v-select
            v-model="statusFilter"
            :items="statusFilterOptions"
            class="users-directory-toolbar__filter"
            hide-details
            item-title="title"
            item-value="value"
            label="Status"
          />
        </div>

        <div class="users-directory-meta">
          <div class="users-directory-meta__summary">{{ filteredUsersSummary }}</div>
          <div class="users-directory-meta__hint">
            Use Profile for your own account details. Use this page for access administration.
          </div>
        </div>

        <v-skeleton-loader
          v-if="usersLoading"
          type="table-heading, table-row-divider, table-row-divider, table-row-divider"
        />

        <div v-else class="journey-panel pa-0 overflow-hidden users-directory-table-shell">
          <v-table class="users-directory-table" density="comfortable" hover>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Activity</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in filteredUsers" :key="user.id">
                <td class="user-table-cell">
                  <div class="user-row">
                    <v-avatar size="42">
                      <v-img :src="user.avatar_url || user.gravatar_url" cover />
                    </v-avatar>
                    <div class="user-row__identity">
                      <div class="user-row__title">
                        <span class="user-row__name">{{ user.full_name || user.username }}</span>
                        <v-chip
                          v-if="user.id === currentUserId"
                          color="secondary"
                          label
                          size="x-small"
                          variant="tonal"
                        >
                          You
                        </v-chip>
                      </div>
                      <div class="text-caption text-medium-emphasis">@{{ user.username }}</div>
                      <div v-if="user.email" class="text-caption text-medium-emphasis">{{ user.email }}</div>
                    </div>
                  </div>
                </td>
                <td class="user-table-cell">
                  <div class="d-flex flex-column ga-2">
                    <v-chip
                      :color="user.role === 'superuser' ? 'secondary' : user.role === 'editor' ? 'primary' : 'info'"
                      class="align-self-start"
                      label
                      size="small"
                      variant="tonal"
                    >
                      {{ roleLabel(user.role) }}
                    </v-chip>
                    <div class="text-caption text-medium-emphasis">
                      {{ roleSummary(user.role) }}
                    </div>
                  </div>
                </td>
                <td class="user-table-cell">
                  <div class="d-flex flex-wrap ga-2">
                    <v-chip :color="user.is_active ? 'accent' : 'surface-variant'" label size="small" variant="tonal">
                      {{ user.is_active ? "Active" : "Disabled" }}
                    </v-chip>
                    <v-chip :color="user.must_change_password ? 'warning' : 'success'" label size="small" variant="tonal">
                      {{ user.must_change_password ? "Reset required" : "Password current" }}
                    </v-chip>
                  </div>
                </td>
                <td class="user-table-cell">
                  <div class="user-activity">
                    <div class="user-activity__row">
                      <span class="text-medium-emphasis">Last sign-in</span>
                      <span>{{ formatDateTime(user.last_login_at) }}</span>
                    </div>
                    <div class="user-activity__row">
                      <span class="text-medium-emphasis">Created</span>
                      <span>{{ formatDateTime(user.created_at) }}</span>
                    </div>
                  </div>
                </td>
                <td class="user-table-cell text-right">
                  <v-btn
                    color="primary"
                    prepend-icon="mdi-pencil-outline"
                    rounded="xl"
                    size="small"
                    variant="text"
                    @click="openEditDialog(user)"
                  >
                    Edit
                  </v-btn>
                </td>
              </tr>
              <tr v-if="!filteredUsers.length">
                <td class="text-medium-emphasis py-8 text-center" colspan="5">
                  No users match the current search and filter settings.
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </v-card-text>
    </v-card>

    <v-dialog v-model="createDialog" max-width="760">
      <v-card class="workspace-card">
        <v-card-item>
          <template #prepend>
            <v-avatar color="secondary" variant="tonal">
              <v-icon icon="mdi-account-plus-outline" />
            </v-avatar>
          </template>

          <v-card-title>Add a user</v-card-title>
          <v-card-subtitle>Create a dashboard account with profile details and an explicit role.</v-card-subtitle>
        </v-card-item>

        <v-divider />

        <v-card-text class="d-flex flex-column ga-4">
          <v-alert v-if="createError" border="start" closable color="error" variant="tonal" @click:close="createError = null">
            {{ createError }}
          </v-alert>

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="createForm.fullName"
                autocomplete="name"
                label="Full name"
                prepend-inner-icon="mdi-badge-account-outline"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="createForm.username"
                autocomplete="username"
                label="Username"
                prepend-inner-icon="mdi-account-outline"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="createForm.email"
                autocomplete="email"
                label="Email"
                prepend-inner-icon="mdi-email-outline"
                type="email"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="createForm.avatarUrl"
                label="Profile image URL"
                prepend-inner-icon="mdi-image-outline"
              />
            </v-col>
            <v-col cols="12">
              <div class="text-caption text-medium-emphasis mt-n3">
                Leave this blank to fall back to Gravatar when an email is present.
              </div>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="createForm.password"
                autocomplete="new-password"
                label="Initial password"
                prepend-inner-icon="mdi-lock-plus-outline"
                type="password"
              />
            </v-col>
          </v-row>

          <div class="journey-panel d-flex flex-column ga-4">
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="createForm.role"
                  :items="roleOptions"
                  item-title="title"
                  item-value="value"
                  label="Role"
                />
                <div class="text-caption text-medium-emphasis mt-2">
                  {{ roleSummary(createForm.role) }}
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="d-flex flex-wrap ga-4">
                  <v-switch v-model="createForm.isActive" color="accent" inset label="Active account" />
                  <v-switch
                    v-model="createForm.mustChangePassword"
                    color="warning"
                    inset
                    label="Require password reset"
                  />
                </div>
              </v-col>
            </v-row>
          </div>
        </v-card-text>

        <v-divider />

        <v-card-actions class="px-6 py-4">
          <v-spacer />
          <v-btn rounded="xl" variant="text" @click="closeCreateDialog">Cancel</v-btn>
          <v-btn
            color="primary"
            rounded="xl"
            :loading="createBusy"
            prepend-icon="mdi-account-plus-outline"
            @click="submitCreateUser"
          >
            Create user
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="editDialog" max-width="640">
      <v-card class="workspace-card">
        <v-card-item>
          <template #prepend>
            <v-avatar color="info" variant="tonal">
              <v-img v-if="activeEditUser" :src="activeEditUser.avatar_url || activeEditUser.gravatar_url" cover />
              <v-icon v-else icon="mdi-account-cog-outline" />
            </v-avatar>
          </template>

          <v-card-title>Edit admin user</v-card-title>
          <v-card-subtitle>Update profile details, access, account status, or issue a password reset.</v-card-subtitle>
        </v-card-item>

        <v-divider />

        <v-card-text class="d-flex flex-column ga-4">
          <v-alert v-if="editError" border="start" closable color="error" variant="tonal" @click:close="editError = null">
            {{ editError }}
          </v-alert>

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="editForm.fullName"
                :disabled="isEditingCurrentUser"
                autocomplete="name"
                label="Full name"
                prepend-inner-icon="mdi-badge-account-outline"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="editForm.username"
                :disabled="isEditingCurrentUser"
                autocomplete="username"
                label="Username"
                prepend-inner-icon="mdi-account-outline"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="editForm.email"
                :disabled="isEditingCurrentUser"
                autocomplete="email"
                label="Email"
                prepend-inner-icon="mdi-email-outline"
                type="email"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="editForm.avatarUrl"
                :disabled="isEditingCurrentUser"
                label="Profile image URL"
                prepend-inner-icon="mdi-image-outline"
              />
            </v-col>
            <v-col cols="12">
              <div class="text-caption text-medium-emphasis mt-n3">
                Leave this blank to fall back to Gravatar when an email is present.
              </div>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="editForm.password"
                :disabled="isEditingCurrentUser"
                autocomplete="new-password"
                label="Reset password"
                prepend-inner-icon="mdi-lock-plus-outline"
                type="password"
              />
            </v-col>
          </v-row>

          <v-alert
            v-if="isEditingCurrentUser"
            border="start"
            color="info"
            variant="tonal"
          >
            Use your Profile page for your own name, email, username, and password. Use another superuser account if you need to change your own role or disable this account.
          </v-alert>

          <div class="journey-panel d-flex flex-column ga-4">
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="editForm.role"
                  :disabled="isEditingCurrentUser"
                  :items="roleOptions"
                  item-title="title"
                  item-value="value"
                  label="Role"
                />
                <div class="text-caption text-medium-emphasis mt-2">
                  {{ roleSummary(editForm.role) }}
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="d-flex flex-wrap ga-4">
                  <v-switch v-model="editForm.isActive" :disabled="isEditingCurrentUser" color="accent" inset label="Active account" />
                  <v-switch
                    v-model="editForm.mustChangePassword"
                    :disabled="isEditingCurrentUser"
                    color="warning"
                    inset
                    label="Require password reset"
                  />
                </div>
              </v-col>
            </v-row>
          </div>

          <v-list v-if="activeEditUser" class="bg-transparent pa-0" density="compact" lines="two">
            <v-list-item
              prepend-icon="mdi-clock-check-outline"
              :subtitle="formatDateTime(activeEditUser.last_login_at)"
              title="Last sign-in"
            />
            <v-list-item
              prepend-icon="mdi-lock-check-outline"
              :subtitle="formatDateTime(activeEditUser.password_changed_at)"
              title="Password updated"
            />
            <v-list-item
              prepend-icon="mdi-calendar-outline"
              :subtitle="formatDateTime(activeEditUser.created_at)"
              title="Account created"
            />
          </v-list>
        </v-card-text>

        <v-divider />

        <v-card-actions class="px-6 py-4 d-flex justify-space-between">
          <v-btn
            color="error"
            :disabled="isEditingCurrentUser"
            prepend-icon="mdi-delete-outline"
            rounded="xl"
            variant="text"
            @click="removeUser"
          >
            Delete
          </v-btn>
          <div class="d-flex ga-2">
            <v-btn rounded="xl" variant="text" @click="editDialog = false">Cancel</v-btn>
            <v-btn
              color="primary"
              rounded="xl"
              :loading="editBusy"
              prepend-icon="mdi-content-save-outline"
              @click="submitUserUpdate"
            >
              Save changes
            </v-btn>
          </div>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
