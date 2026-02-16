import type { Assignment, AuditEvent, Environment, Project, Role, Secret, SecretType, User } from "../types";

const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const API_BASE_URL = RAW_API_BASE_URL.startsWith("http://") || RAW_API_BASE_URL.startsWith("https://")
  ? RAW_API_BASE_URL
  : `https://${RAW_API_BASE_URL}`;
const ACCESS_TOKEN_KEY = "api-key-organizer-access-token";
const REFRESH_TOKEN_KEY = "api-key-organizer-refresh-token";

type RequestOptions = {
  role: Role;
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
};

type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
};

const roleCredentials: Record<Role, { email: string; password: string }> = {
  admin: { email: "admin@company.local", password: "admin123" },
  member: { email: "member@company.local", password: "member123" },
  viewer: { email: "viewer@company.local", password: "viewer123" },
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

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const accessToken = getAccessToken();

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : { "x-user-role": options.role }),
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

export async function loginByRole(role: Role) {
  const credentials = roleCredentials[role];
  const response = await request<AuthTokensResponse>("/auth/login", {
    role,
    method: "POST",
    body: credentials,
  });
  setTokens(response);
}

export async function refreshSession(role: Role) {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token");
  }
  const response = await request<AuthTokensResponse>("/auth/refresh", {
    role,
    method: "POST",
    body: { refreshToken },
  });
  setTokens(response);
}

export async function logoutSession(role: Role) {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await request<{ message: string }>("/auth/logout", {
      role,
      method: "POST",
      body: { refreshToken },
    });
  }
  clearTokens();
}

export async function fetchMe(role: Role): Promise<User> {
  const response = await request<MeResponse>("/me", { role });
  return {
    id: response.id,
    name: response.name,
    role: response.role,
    assignments: response.assignments,
  };
}

export function fetchProjects(role: Role) {
  return request<ProjectSummary[]>("/projects", { role });
}

export function fetchProjectSecrets(params: {
  role: Role;
  projectId: string;
  env?: Environment;
  provider?: string;
  tag?: string;
  type?: SecretType;
}) {
  return request<Secret[]>(`/projects/${params.projectId}/secrets`, {
    role: params.role,
    query: {
      env: params.env,
      provider: params.provider,
      tag: params.tag,
      type: params.type,
    },
  });
}

export function createProjectSecret(params: { role: Role; projectId: string; payload: SecretMutationPayload }) {
  return request<Secret>(`/projects/${params.projectId}/secrets`, {
    role: params.role,
    method: "POST",
    body: params.payload,
  });
}

export function updateProjectSecret(params: {
  role: Role;
  secretId: string;
  payload: Partial<Omit<SecretMutationPayload, "environment">>;
}) {
  return request<Secret>(`/secrets/${params.secretId}`, {
    role: params.role,
    method: "PATCH",
    body: params.payload,
  });
}

export function deleteProjectSecret(params: { role: Role; secretId: string }) {
  return request<void>(`/secrets/${params.secretId}`, {
    role: params.role,
    method: "DELETE",
  });
}

export function revealSecretValue(params: { role: Role; secretId: string }) {
  return request<{ secretId: string; keyName: string; value: string }>(`/secrets/${params.secretId}/reveal`, {
    role: params.role,
  });
}

export function searchSecrets(params: {
  role: Role;
  query: string;
  provider?: string;
  tag?: string;
  environment?: Environment;
  type?: SecretType;
}) {
  return request<Secret[]>("/search", {
    role: params.role,
    query: {
      q: params.query,
      provider: params.provider,
      tag: params.tag,
      environment: params.environment,
      type: params.type,
    },
  });
}

export function trackCopyEvent(params: { role: Role; projectId: string; secretId: string }) {
  return request<{ ok: boolean }>("/audit/copy", {
    role: params.role,
    method: "POST",
    body: {
      projectId: params.projectId,
      secretId: params.secretId,
    },
  });
}

export function fetchAudit(params: {
  role: Role;
  action?: string;
  projectId?: string;
  userEmail?: string;
  from?: string;
  to?: string;
}) {
  return request<AuditEvent[]>("/audit", {
    role: params.role,
    query: {
      action: params.action,
      projectId: params.projectId,
      userEmail: params.userEmail,
      from: params.from,
      to: params.to,
    },
  });
}

export function previewImport(role: Role, content: string) {
  return request<ImportPreviewResponse>("/imports/preview", {
    role,
    method: "POST",
    body: { content },
  });
}

export function commitImport(params: {
  role: Role;
  projectId: string;
  environment: Environment;
  content: string;
  provider: string;
  type: SecretType;
  conflictStrategy: "skip" | "overwrite" | "new_version";
  tags: string[];
}) {
  return request<ImportCommitResponse>("/imports/commit", {
    role: params.role,
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

export function exportProject(params: { role: Role; projectId: string; env: Environment; format: "env" | "json" }) {
  return request<string>(`/exports/${params.projectId}`, {
    role: params.role,
    responseType: "text",
    query: {
      env: params.env,
      format: params.format,
    },
  });
}
