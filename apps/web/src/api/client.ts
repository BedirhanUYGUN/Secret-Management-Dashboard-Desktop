import type { Assignment, AuditEvent, Environment, ManagedUser, Project, ProjectDetail, ProjectMemberOut, Role, Secret, SecretType, User, UserPreferences } from "../types";

const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const API_BASE_URL = RAW_API_BASE_URL.startsWith("http://") || RAW_API_BASE_URL.startsWith("https://")
  ? RAW_API_BASE_URL
  : `https://${RAW_API_BASE_URL}`;
const ACCESS_TOKEN_KEY = "api-key-organizer-access-token";
const REFRESH_TOKEN_KEY = "api-key-organizer-refresh-token";

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

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setTokens(payload: AuthTokensResponse) {
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
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
  const accessToken = getAccessToken();

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
  const response = await request<AuthTokensResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  setTokens(response);
}

export async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token");
  }
  const response = await request<AuthTokensResponse>("/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  });
  setTokens(response);
}

export async function logoutSession() {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await request<{ message: string }>("/auth/logout", {
      method: "POST",
      body: { refreshToken },
    });
  }
  clearTokens();
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
  conflictStrategy: "skip" | "overwrite" | "new_version";
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
