export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export type AdminRole = "viewer" | "editor" | "superuser";
export type AdminPermission = "routes.read" | "routes.write" | "routes.preview" | "users.manage";

export interface AdminUser {
  id: number;
  username: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  gravatar_url: string;
  is_active: boolean;
  role: AdminRole;
  permissions: AdminPermission[];
  is_superuser: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  password_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminSession {
  token: string;
  expires_at: string;
  user: AdminUser;
}

export interface AdminSessionSnapshot {
  expires_at: string;
  user: AdminUser;
}

export interface AdminLoginPayload {
  username: string;
  password: string;
  remember_me: boolean;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface AdminAccountUpdatePayload {
  username?: string;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

export interface AdminUserCreatePayload {
  username: string;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  password: string;
  is_active?: boolean;
  role?: AdminRole;
  must_change_password?: boolean;
}

export interface AdminUserUpdatePayload {
  username?: string;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  password?: string;
  is_active?: boolean;
  role?: AdminRole;
  must_change_password?: boolean;
}

export interface EndpointPayload {
  name: string;
  slug?: string | null;
  method: string;
  path: string;
  category: string | null;
  tags: string[];
  summary: string | null;
  description: string | null;
  enabled: boolean;
  auth_mode: string;
  request_schema: JsonObject | null;
  response_schema: JsonObject | null;
  success_status_code: number;
  error_rate: number;
  latency_min_ms: number;
  latency_max_ms: number;
  seed_key: string | null;
}

export interface Endpoint extends Omit<EndpointPayload, "slug"> {
  slug: string;
  id: number;
  created_at: string;
  updated_at: string;
}

export type EndpointImportMode = "create_only" | "upsert" | "replace_all";

export interface EndpointBundle {
  schema_version: number;
  product: string;
  exported_at: string;
  endpoints: EndpointPayload[];
}

export interface EndpointImportRequestPayload {
  bundle: EndpointBundle;
  mode: EndpointImportMode;
  dry_run: boolean;
  confirm_replace_all: boolean;
}

export interface EndpointImportOperation {
  action: string;
  method: string;
  path: string;
  name: string;
  detail: string | null;
}

export interface EndpointImportSummary {
  endpoint_count: number;
  create_count: number;
  update_count: number;
  delete_count: number;
  skip_count: number;
  error_count: number;
}

export interface EndpointImportResponse {
  dry_run: boolean;
  applied: boolean;
  has_errors: boolean;
  mode: EndpointImportMode;
  summary: EndpointImportSummary;
  operations: EndpointImportOperation[];
}

export interface EndpointDraft {
  name: string;
  method: string;
  path: string;
  category: string;
  tags: string;
  summary: string;
  description: string;
  enabled: boolean;
  auth_mode: string;
  request_schema: JsonObject;
  response_schema: JsonObject;
  success_status_code: number;
  error_rate: number;
  latency_min_ms: number;
  latency_max_ms: number;
  seed_key: string;
}

export interface PreviewResponsePayload {
  preview: JsonValue;
}
