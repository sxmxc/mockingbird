<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { AdminApiError, changePassword, getAccountProfile, updateAccountProfile } from "../api/admin";
import { useAuth } from "../composables/useAuth";
import type { AdminUser } from "../types/endpoints";
import { roleLabel } from "../utils/adminAccess";

const auth = useAuth();
const router = useRouter();

const profile = ref<AdminUser | null>(null);
const isLoading = ref(false);
const profileBusy = ref(false);
const profileError = ref<string | null>(null);
const profileSuccess = ref<string | null>(null);
const passwordBusy = ref(false);
const passwordError = ref<string | null>(null);
const passwordSuccess = ref<string | null>(null);

const profileForm = reactive({
  username: "",
  fullName: "",
  email: "",
  avatarUrl: "",
});
const passwordForm = reactive({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const activeProfile = computed(() => profile.value ?? auth.user.value);
const activeRoleLabel = computed(() => roleLabel(activeProfile.value?.role));
const permissionChips = computed(() => activeProfile.value?.permissions ?? []);
const isProfileDirty = computed(() =>
  profileForm.username.trim() !== (activeProfile.value?.username ?? "") ||
  profileForm.fullName.trim() !== (activeProfile.value?.full_name ?? "") ||
  profileForm.email.trim() !== (activeProfile.value?.email ?? "") ||
  profileForm.avatarUrl.trim() !== (activeProfile.value?.avatar_url ?? ""),
);
const activeAvatarSrc = computed(() => activeProfile.value?.avatar_url || activeProfile.value?.gravatar_url || "");

function describeError(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

function handleExpiredSession(error: unknown, message: string): boolean {
  if (error instanceof AdminApiError && error.status === 401) {
    void auth.logout(message);
    void router.push({ name: "login" });
    return true;
  }

  return false;
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

async function loadProfile(): Promise<void> {
  if (!auth.session.value) {
    profile.value = null;
    profileForm.username = "";
    profileForm.fullName = "";
    profileForm.email = "";
    profileForm.avatarUrl = "";
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  profileError.value = null;

  try {
    const loadedProfile = await getAccountProfile(auth.session.value);
    profile.value = loadedProfile;
    profileForm.username = loadedProfile.username;
    profileForm.fullName = loadedProfile.full_name ?? "";
    profileForm.email = loadedProfile.email ?? "";
    profileForm.avatarUrl = loadedProfile.avatar_url ?? "";
  } catch (error) {
    if (handleExpiredSession(error, "Your admin session expired. Sign in again before managing your profile.")) {
      return;
    }

    profileError.value = describeError(error, "Unable to load your account profile.");
  } finally {
    isLoading.value = false;
  }
}

watch(
  () => auth.session.value?.token,
  () => {
    void loadProfile();
  },
  { immediate: true },
);

async function submitProfileUpdate(): Promise<void> {
  if (!auth.session.value) {
    profileError.value = "Sign in again before saving profile changes.";
    return;
  }

  profileError.value = null;
  profileSuccess.value = null;

  if (!profileForm.username.trim()) {
    profileError.value = "Enter a username for this account.";
    return;
  }

  profileBusy.value = true;

  try {
    const snapshot = await updateAccountProfile(
      {
        username: profileForm.username.trim(),
        full_name: normalizeOptionalText(profileForm.fullName),
        email: normalizeOptionalText(profileForm.email),
        avatar_url: normalizeOptionalText(profileForm.avatarUrl),
      },
      auth.session.value,
    );
    auth.updateCurrentSession(snapshot);
    profile.value = snapshot.user;
    profileForm.username = snapshot.user.username;
    profileForm.fullName = snapshot.user.full_name ?? "";
    profileForm.email = snapshot.user.email ?? "";
    profileForm.avatarUrl = snapshot.user.avatar_url ?? "";
    profileSuccess.value = "Saved your account profile.";
  } catch (error) {
    if (handleExpiredSession(error, "Your admin session expired. Sign in again before saving profile changes.")) {
      return;
    }

    profileError.value = describeError(error, "Unable to save your account profile.");
  } finally {
    profileBusy.value = false;
  }
}

async function submitPasswordChange(): Promise<void> {
  if (!auth.session.value) {
    passwordError.value = "Sign in again before changing your password.";
    return;
  }

  passwordError.value = null;
  passwordSuccess.value = null;

  if (!passwordForm.currentPassword || !passwordForm.newPassword) {
    passwordError.value = "Enter your current password and a new password.";
    return;
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = "The new password confirmation does not match.";
    return;
  }

  passwordBusy.value = true;

  try {
    const snapshot = await changePassword(
      {
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
      },
      auth.session.value,
    );
    auth.updateCurrentSession(snapshot);
    profile.value = snapshot.user;
    passwordForm.currentPassword = "";
    passwordForm.newPassword = "";
    passwordForm.confirmPassword = "";
    passwordSuccess.value = "Your password has been updated.";
  } catch (error) {
    if (handleExpiredSession(error, "Your admin session expired. Sign in again before changing your password.")) {
      return;
    }

    passwordError.value = describeError(error, "Unable to change your password.");
  } finally {
    passwordBusy.value = false;
  }
}
</script>

<template>
  <div class="d-flex flex-column ga-4">
    <div class="d-flex flex-column flex-lg-row justify-space-between ga-4">
      <div>
        <div class="text-overline text-secondary">Account</div>
        <div class="text-h3 font-weight-bold mt-2">Your profile</div>
        <div class="text-body-1 text-medium-emphasis mt-3">
          Manage your account details, see your access level, and rotate your password.
        </div>
      </div>

      <div class="d-flex flex-wrap align-start justify-end ga-2">
        <v-chip color="secondary" label variant="tonal">
          {{ activeRoleLabel }}
        </v-chip>
        <v-chip v-if="auth.mustChangePassword.value" color="warning" label variant="tonal">
          Password change required
        </v-chip>
      </div>
    </div>

    <v-alert
      v-if="auth.mustChangePassword.value"
      border="start"
      color="warning"
      variant="tonal"
    >
      This account is still using a bootstrap or reset password. Change it now before the rest of the admin API unlocks.
    </v-alert>

    <v-row class="workspace-grid">
      <v-col cols="12" xl="4" lg="5">
        <v-card class="workspace-card fill-height">
          <v-card-item>
            <template #prepend>
              <v-avatar color="secondary" variant="tonal">
                <v-img v-if="activeAvatarSrc" :src="activeAvatarSrc" cover />
                <v-icon v-else icon="mdi-account-circle-outline" />
              </v-avatar>
            </template>

            <v-card-title>Account summary</v-card-title>
            <v-card-subtitle>Your current role and recent account activity.</v-card-subtitle>
          </v-card-item>

          <v-divider />

          <v-card-text class="d-flex flex-column ga-4">
            <v-skeleton-loader
              v-if="isLoading"
              type="list-item-two-line, list-item-two-line, list-item-two-line"
            />

            <template v-else-if="activeProfile">
              <div>
                <div class="text-overline text-medium-emphasis">Full name</div>
                <div class="text-h6 font-weight-medium mt-1">{{ activeProfile.full_name || "Not set yet" }}</div>
              </div>

              <div>
                <div class="text-overline text-medium-emphasis">Username</div>
                <div class="text-h5 font-weight-bold mt-1">{{ activeProfile.username }}</div>
              </div>

              <div>
                <div class="text-overline text-medium-emphasis">Email</div>
                <div class="text-body-1 mt-1">{{ activeProfile.email || "Not set yet" }}</div>
              </div>

              <div>
                <div class="text-overline text-medium-emphasis">Permissions</div>
                <div class="d-flex flex-wrap ga-2 mt-2">
                  <v-chip
                    v-for="permission in permissionChips"
                    :key="permission"
                    color="primary"
                    label
                    size="small"
                    variant="tonal"
                  >
                    {{ permission }}
                  </v-chip>
                </div>
              </div>

              <v-list class="bg-transparent pa-0" lines="two">
                <v-list-item
                  prepend-icon="mdi-shield-account-outline"
                  :subtitle="activeRoleLabel"
                  title="Role"
                />
                <v-list-item
                  prepend-icon="mdi-clock-check-outline"
                  :subtitle="formatDateTime(activeProfile.last_login_at)"
                  title="Last sign-in"
                />
                <v-list-item
                  prepend-icon="mdi-lock-check-outline"
                  :subtitle="formatDateTime(activeProfile.password_changed_at)"
                  title="Password updated"
                />
                <v-list-item
                  prepend-icon="mdi-calendar-outline"
                  :subtitle="formatDateTime(activeProfile.created_at)"
                  title="Account created"
                />
              </v-list>
            </template>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" xl="8" lg="7">
        <div class="d-flex flex-column ga-4">
          <v-card class="workspace-card">
            <v-card-item>
              <template #prepend>
                <v-avatar color="info" variant="tonal">
                  <v-icon icon="mdi-account-edit-outline" />
                </v-avatar>
              </template>

              <v-card-title>Profile details</v-card-title>
              <v-card-subtitle>Update the personal details tied to this admin account.</v-card-subtitle>
            </v-card-item>

            <v-divider />

            <v-card-text class="d-flex flex-column ga-4">
              <v-alert v-if="profileSuccess" border="start" closable color="success" variant="tonal" @click:close="profileSuccess = null">
                {{ profileSuccess }}
              </v-alert>

              <v-alert v-if="profileError" border="start" closable color="error" variant="tonal" @click:close="profileError = null">
                {{ profileError }}
              </v-alert>

              <v-text-field
                v-model="profileForm.fullName"
                autocomplete="name"
                label="Full name"
                prepend-inner-icon="mdi-badge-account-outline"
              />

              <v-text-field
                v-model="profileForm.username"
                autocomplete="username"
                label="Username"
                prepend-inner-icon="mdi-account-outline"
              />

              <v-text-field
                v-model="profileForm.email"
                autocomplete="email"
                label="Email"
                prepend-inner-icon="mdi-email-outline"
                type="email"
              />

              <v-text-field
                v-model="profileForm.avatarUrl"
                label="Profile image URL"
                prepend-inner-icon="mdi-image-outline"
              />

              <div class="text-caption text-medium-emphasis">
                Leave this blank to fall back to Gravatar.
              </div>

              <div class="d-flex justify-end">
                <v-btn
                  color="primary"
                  :disabled="!isProfileDirty"
                  :loading="profileBusy"
                  prepend-icon="mdi-content-save-outline"
                  @click="submitProfileUpdate"
                >
                  Save profile
                </v-btn>
              </div>
            </v-card-text>
          </v-card>

          <v-card class="workspace-card">
            <v-card-item>
              <template #prepend>
                <v-avatar color="primary" variant="tonal">
                  <v-icon icon="mdi-lock-reset" />
                </v-avatar>
              </template>

              <v-card-title>Change password</v-card-title>
              <v-card-subtitle>Use a new password for this account.</v-card-subtitle>
            </v-card-item>

            <v-divider />

            <v-card-text class="d-flex flex-column ga-4">
              <v-alert v-if="passwordSuccess" border="start" closable color="success" variant="tonal" @click:close="passwordSuccess = null">
                {{ passwordSuccess }}
              </v-alert>

              <v-alert v-if="passwordError" border="start" closable color="error" variant="tonal" @click:close="passwordError = null">
                {{ passwordError }}
              </v-alert>

              <v-text-field
                v-model="passwordForm.currentPassword"
                autocomplete="current-password"
                label="Current password"
                prepend-inner-icon="mdi-lock-outline"
                type="password"
              />

              <v-text-field
                v-model="passwordForm.newPassword"
                autocomplete="new-password"
                label="New password"
                prepend-inner-icon="mdi-lock-plus-outline"
                type="password"
              />

              <v-text-field
                v-model="passwordForm.confirmPassword"
                autocomplete="new-password"
                label="Confirm new password"
                prepend-inner-icon="mdi-lock-check-outline"
                type="password"
              />

              <div class="d-flex justify-end">
                <v-btn
                  color="primary"
                  :loading="passwordBusy"
                  prepend-icon="mdi-content-save-outline"
                  @click="submitPasswordChange"
                >
                  Save password
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </div>
      </v-col>
    </v-row>
  </div>
</template>
