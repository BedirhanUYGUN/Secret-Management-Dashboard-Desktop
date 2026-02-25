import type { Assignment, AuditEvent, Environment, Invite, InviteCreateResult, ManagedUser, OrganizationSummary, Project, ProjectDetail, ProjectMemberOut, Role, Secret, SecretType, User, UserPreferences } from "../types";
import { isTauriRuntime } from "../platform/runtime";
import {
  clearStoredTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  setStoredTokens,
} from "../platform/tokenStorage";

const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const API_BASE_URL = RAW_API_BASE_URL.startsWith("http://") || RAW_API_BASE_URL.startsWith("https://")
  ? RAW_API_BASE_URL
  : `https://${RAW_API_BASE_URL}`;

const SUPABASE_AUTH_ENABLED = String(import.meta.env.VITE_SUPABASE_AUTH_ENABLED ?? "false").toLowerCase() === "true";
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

const DESKTOP_ALLOWED_API_ORIGINS = new Set(
  String(import.meta.env.VITE_ALLOWED_API_ORIGINS ?? "http://localhost:4000,https://localhost:4000")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | undefined>;
  body?: unknown;
  responseType?: "json" | "text";
};

export type ProjectSummary = Project & { keyCount: number; prodAccess: boolean };

export type ImportPreviewResponse = {
  heading: string | null;
  totalPairs: number;
  skipped: number;
  preview: Array<{ key: string; value: string }>;
};

export type ImportCommitResponse = {
  projectId: string;
  environment: Environment;
  inserted: number;
  updated: number;
  skipped: number;
  total: number;
};

export type SecretMutationPayload = {
  name: string;
  provider: string;
  type: SecretType;
  environment: Environment;
  keyName: string;
  value: string;
  tags: string[];
  notes: string;
};

export type RegisterPurpose = "personal" | "organization";
export type RegisterOrganizationMode = "create" | "join";

export type RegisterRequestPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  purpose: RegisterPurpose;
  organizationMode: RegisterOrganizationMode;
  organizationName?: string;
  inviteCode?: string;
};

export type RegisterResponse = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  projectId: string;
  projectName: string;
  membershipRole: Role;
  inviteCode: string | null;
};

type MeResponse = {
  id: string;
  email: string;
  name: string;
  role: Role;
  assignments: Assignment[];
  preferences: UserPreferences;
};

type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
};

type SupabaseTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at?: number;
};

function assertDesktopApiUrlAllowed() {
  if (!isTauriRuntime()) {
    return;
  }

  const origin = new URL(API_BASE_URL).origin;
  if (!DESKTOP_ALLOWED_API_ORIGINS.has(origin)) {
    throw new Error(`Desktop modunda izin verilmeyen API origin: ${origin}`);
  }
}

assertDesktopApiUrlAllowed();

function setTokens(payload: AuthTokensResponse) {
  return setStoredTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken });
}

function ensureSupabaseConfig() {
  if (!SUPABASE_AUTH_ENABLED) {
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase auth aktif ama VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY eksik");
  }
}

async function supabaseAuthRequest<T>(
  path: string,
  options: { method: "GET" | "POST"; body?: unknown; accessToken?: string },
) {
  ensureSupabaseConfig();
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1${path}`, {
    method: options.method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Supabase auth request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function mapSupabaseTokens(payload: SupabaseTokenResponse): AuthTokensResponse {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenType: payload.token_type,
    expiresAt: payload.expires_at ? new Date(payload.expires_at * 1000).toISOString() : new Date().toISOString(),
  };
}

export function clearTokens() {
  return clearStoredTokens();
}

function buildUrl(path: string, query?: Record<string, string | undefined>) {
  const url = new URL(path, API_BASE_URL);
  if (!query) {
    return url.toString();
  }
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const accessToken = await getStoredAccessToken();

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  if (options.responseType === "text") {
    return (await response.text()) as T;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function loginWithCredentials(email: string, password: string) {
  if (SUPABASE_AUTH_ENABLED) {
    const response = await supabaseAuthRequest<SupabaseTokenResponse>("/token?grant_type=password", {
      method: "POST",
      body: { email, password },
    });
    await setTokens(mapSupabaseTokens(response));
    return;
  }

  const response = await request<AuthTokensResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  await setTokens(response);
}

export function registerWithProfile(payload: RegisterRequestPayload) {
  return request<RegisterResponse>("/auth/register", {
    method: "POST",
    body: payload,
  });
}

export async function refreshSession() {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token");
  }

  if (SUPABASE_AUTH_ENABLED) {
    const response = await supabaseAuthRequest<SupabaseTokenResponse>("/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: refreshToken },
    });
    await setTokens(mapSupabaseTokens(response));
    return;
  }

  const response = await request<AuthTokensResponse>("/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  });
  await setTokens(response);
}

export async function logoutSession() {
  const refreshToken = await getStoredRefreshToken();
  const accessToken = await getStoredAccessToken();

  if (SUPABASE_AUTH_ENABLED) {
    if (accessToken) {
      await supabaseAuthRequest<void>("/logout", {
        method: "POST",
        accessToken,
      });
    }
    await clearTokens();
    return;
  }

  if (refreshToken) {
    await request<{ message: string }>("/auth/logout", {
      method: "POST",
      body: { refreshToken },
    });
  }
  await clearTokens();
}

export async function fetchMe(): Promise<User> {
  const response = await request<MeResponse>("/me");
  return {
    id: response.id,
    name: response.name,
    role: response.role,
    assignments: response.assignments,
    preferences: response.preferences ?? {},
  };
}

export async function updatePreferences(params: UserPreferences): Promise<User> {
  const response = await request<MeResponse>("/me/preferences", {
    method: "PATCH",
    body: params,
  });
  return {
    id: response.id,
    name: response.name,
    role: response.role,
    assignments: response.assignments,
    preferences: response.preferences ?? {},
  };
}

export function fetchProjects() {
  return request<ProjectSummary[]>("/projects");
}

export function fetchProjectSecrets(params: {
  projectId: string;
  env?: Environment;
  provider?: string;
  tag?: string;
  type?: SecretType;
}) {
  return request<Secret[]>(`/projects/${params.projectId}/secrets`, {
    query: {
      env: params.env,
      provider: params.provider,
      tag: params.tag,
      type: params.type,
    },
  });
}

export function createProjectSecret(params: { projectId: string; payload: SecretMutationPayload }) {
  return request<Secret>(`/projects/${params.projectId}/secrets`, {
    method: "POST",
    body: params.payload,
  });
}

export function updateProjectSecret(params: {
  secretId: string;
  payload: Partial<Omit<SecretMutationPayload, "environment">>;
}) {
  return request<Secret>(`/secrets/${params.secretId}`, {
    method: "PATCH",
    body: params.payload,
  });
}

export function deleteProjectSecret(params: { secretId: string }) {
  return request<void>(`/secrets/${params.secretId}`, {
    method: "DELETE",
  });
}

export function revealSecretValue(params: { secretId: string }) {
  return request<{ secretId: string; keyName: string; value: string }>(`/secrets/${params.secretId}/reveal`);
}

export function searchSecrets(params: {
  query: string;
  provider?: string;
  tag?: string;
  environment?: Environment;
  type?: SecretType;
}) {
  return request<Secret[]>("/search", {
    query: {
      q: params.query,
      provider: params.provider,
      tag: params.tag,
      environment: params.environment,
      type: params.type,
    },
  });
}

export function trackCopyEvent(params: { projectId: string; secretId: string }) {
  return request<{ ok: boolean }>("/audit/copy", {
    method: "POST",
    body: {
      projectId: params.projectId,
      secretId: params.secretId,
    },
  });
}

export function fetchAudit(params: {
  action?: string;
  projectId?: string;
  userEmail?: string;
  from?: string;
  to?: string;
}) {
  return request<AuditEvent[]>("/audit", {
    query: {
      action: params.action,
      projectId: params.projectId,
      userEmail: params.userEmail,
      from: params.from,
      to: params.to,
    },
  });
}

export function previewImport(content: string) {
  return request<ImportPreviewResponse>("/imports/preview", {
    method: "POST",
    body: { content },
  });
}

export function commitImport(params: {
  projectId: string;
  environment: Environment;
  content: string;
  provider: string;
  type: SecretType;
  conflictStrategy: "skip" | "overwrite";
  tags: string[];
}) {
  return request<ImportCommitResponse>("/imports/commit", {
    method: "POST",
    body: {
      projectId: params.projectId,
      environment: params.environment,
      content: params.content,
      provider: params.provider,
      type: params.type,
      conflictStrategy: params.conflictStrategy,
      tags: params.tags,
    },
  });
}

export function exportProject(params: { projectId: string; env: Environment; format: "env" | "json"; tag?: string }) {
  return request<string>(`/exports/${params.projectId}`, {
    responseType: "text",
    query: {
      env: params.env,
      format: params.format,
      tag: params.tag,
    },
  });
}

export function exportProjectAllEnvs(params: { projectId: string; format: "env" | "json"; tag?: string }) {
  return request<string>(`/exports/${params.projectId}/all`, {
    responseType: "text",
    query: {
      format: params.format,
      tag: params.tag,
    },
  });
}

// ---------------------------------------------------------------------------
// User Management (admin only)
// ---------------------------------------------------------------------------

export function fetchUsers() {
  return request<ManagedUser[]>("/users");
}

export function createUser(params: { email: string; displayName: string; role: Role; password: string }) {
  return request<ManagedUser>("/users", {
    method: "POST",
    body: params,
  });
}

export function updateUser(params: { userId: string; displayName?: string; role?: Role; isActive?: boolean; password?: string }) {
  const { userId, ...body } = params;
  return request<ManagedUser>(`/users/${userId}`, {
    method: "PATCH",
    body,
  });
}

// ---------------------------------------------------------------------------
// Project Management (admin only)
// ---------------------------------------------------------------------------

export function fetchProjectDetails() {
  return request<ProjectDetail[]>("/projects/manage");
}

export function createProject(params: { name: string; slug: string; description: string; tags: string[] }) {
  return request<ProjectDetail>("/projects/manage", {
    method: "POST",
    body: params,
  });
}

export function updateProject(params: { projectId: string; name?: string; description?: string; tags?: string[] }) {
  const { projectId, ...body } = params;
  return request<ProjectDetail>(`/projects/manage/${projectId}`, {
    method: "PATCH",
    body,
  });
}

export function deleteProject(projectId: string) {
  return request<void>(`/projects/manage/${projectId}`, { method: "DELETE" });
}

export function addProjectMember(params: { projectId: string; userId: string; role: Role }) {
  return request<ProjectMemberOut>(`/projects/manage/${params.projectId}/members`, {
    method: "POST",
    body: { userId: params.userId, role: params.role },
  });
}

export function removeProjectMember(params: { projectId: string; userId: string }) {
  return request<void>(`/projects/manage/${params.projectId}/members/${params.userId}`, {
    method: "DELETE",
  });
}

export function updateEnvironmentAccess(params: {
  projectId: string;
  userId: string;
  environment: Environment;
  canRead: boolean;
  canExport: boolean;
}) {
  return request<{ ok: boolean }>(`/projects/manage/${params.projectId}/access`, {
    method: "POST",
    body: {
      userId: params.userId,
      environment: params.environment,
      canRead: params.canRead,
      canExport: params.canExport,
    },
  });
}

// ---------------------------------------------------------------------------
// Organization (project-admin scoped)
// ---------------------------------------------------------------------------

export function fetchManagedOrganizations() {
  return request<OrganizationSummary[]>("/organizations/managed");
}

export function fetchOrganizationInvites(projectId: string) {
  return request<Invite[]>(`/organizations/${projectId}/invites`);
}

export function createOrganizationInvite(params: {
  projectId: string;
  expiresInHours?: number;
  maxUses?: number;
}) {
  return request<InviteCreateResult>(`/organizations/${params.projectId}/invites`, {
    method: "POST",
    body: {
      expiresInHours: params.expiresInHours,
      maxUses: params.maxUses,
    },
  });
}

export function rotateOrganizationInvite(params: {
  projectId: string;
  expiresInHours?: number;
  maxUses?: number;
}) {
  return request<InviteCreateResult>(`/organizations/${params.projectId}/invites/rotate`, {
    method: "POST",
    body: {
      expiresInHours: params.expiresInHours,
      maxUses: params.maxUses,
    },
  });
}

export function revokeOrganizationInvite(params: { projectId: string; inviteId: string }) {
  return request<void>(`/organizations/${params.projectId}/invites/${params.inviteId}`, {
    method: "DELETE",
  });
}
