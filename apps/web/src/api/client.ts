import type { AuditEvent, Environment, Project, Role, Secret } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type RequestOptions = {
  role: Role;
  method?: "GET" | "POST";
  query?: Record<string, string | undefined>;
  body?: unknown;
  responseType?: "json" | "text";
};

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
  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": options.role,
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

  return (await response.json()) as T;
}

export type ProjectSummary = Project & { keyCount: number };

export function fetchProjects(role: Role) {
  return request<ProjectSummary[]>("/projects", { role });
}

export function fetchProjectSecrets(params: {
  role: Role;
  projectId: string;
  env: Environment;
  provider?: string;
  tag?: string;
}) {
  return request<Secret[]>(`/projects/${params.projectId}/secrets`, {
    role: params.role,
    query: {
      env: params.env,
      provider: params.provider,
      tag: params.tag,
    },
  });
}

export function searchSecrets(params: {
  role: Role;
  query: string;
  provider?: string;
  tag?: string;
}) {
  return request<Secret[]>("/search", {
    role: params.role,
    query: {
      q: params.query,
      provider: params.provider,
      tag: params.tag,
    },
  });
}

export function fetchAudit(role: Role) {
  return request<AuditEvent[]>("/audit", { role });
}

export function previewImport(role: Role, content: string) {
  return request<{ heading: string | null; totalPairs: number; skipped: number; preview: Array<{ key: string; value: string }> }>(
    "/imports/preview",
    {
      role,
      method: "POST",
      body: { content },
    },
  );
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
