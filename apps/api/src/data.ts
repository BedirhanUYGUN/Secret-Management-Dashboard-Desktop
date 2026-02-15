export type Role = "admin" | "member" | "viewer";
export type EnvName = "local" | "dev" | "prod";

export type Assignment = {
  projectId: string;
  prodAccess: boolean;
};

export type User = {
  id: string;
  email: string;
  role: Role;
  assignments: Assignment[];
};

export type Project = {
  id: string;
  name: string;
  tags: string[];
};

export type Secret = {
  id: string;
  projectId: string;
  environment: EnvName;
  name: string;
  provider: string;
  type: "key" | "token" | "endpoint";
  keyName: string;
  valueMasked: string;
  updatedAt: string;
  tags: string[];
  notes: string;
};

export type AuditEvent = {
  id: string;
  action: "secret_created" | "secret_updated" | "secret_copied" | "secret_exported";
  actor: string;
  projectId: string;
  secretName: string;
  occurredAt: string;
};

export const users: User[] = [
  {
    id: "u-admin",
    email: "admin@company.local",
    role: "admin",
    assignments: [
      { projectId: "apollo", prodAccess: true },
      { projectId: "atlas", prodAccess: true },
      { projectId: "nova", prodAccess: true },
    ],
  },
  {
    id: "u-member",
    email: "member@company.local",
    role: "member",
    assignments: [
      { projectId: "apollo", prodAccess: false },
      { projectId: "atlas", prodAccess: true },
    ],
  },
  {
    id: "u-viewer",
    email: "viewer@company.local",
    role: "viewer",
    assignments: [{ projectId: "apollo", prodAccess: false }],
  },
];

export const projects: Project[] = [
  { id: "apollo", name: "Apollo API", tags: ["payments", "critical"] },
  { id: "atlas", name: "Atlas Core", tags: ["backend"] },
  { id: "nova", name: "Nova Analytics", tags: ["data", "internal"] },
];

export const secrets: Secret[] = [
  {
    id: "s1",
    projectId: "apollo",
    environment: "prod",
    name: "Stripe Payments",
    provider: "Stripe",
    type: "key",
    keyName: "STRIPE_API_KEY",
    valueMasked: "sk_live_...8Xy9",
    updatedAt: "2026-02-15T09:00:00Z",
    tags: ["billing", "prod"],
    notes: "Primary production key for billing.",
  },
  {
    id: "s2",
    projectId: "apollo",
    environment: "dev",
    name: "Vercel Deploy Hook",
    provider: "Vercel",
    type: "endpoint",
    keyName: "VERCEL_DEPLOY_HOOK",
    valueMasked: "https://api.ver...",
    updatedAt: "2026-02-14T09:00:00Z",
    tags: ["deploy"],
    notes: "Used for dev deploy trigger.",
  },
  {
    id: "s3",
    projectId: "atlas",
    environment: "dev",
    name: "Algolia Search",
    provider: "Algolia",
    type: "token",
    keyName: "ALGOLIA_SEARCH_KEY",
    valueMasked: "search_only_...a1b",
    updatedAt: "2026-02-10T09:00:00Z",
    tags: ["search"],
    notes: "Search key for Atlas index.",
  },
];

export const auditEvents: AuditEvent[] = [
  {
    id: "a1",
    action: "secret_created",
    actor: "admin@company.local",
    projectId: "apollo",
    secretName: "Stripe Payments",
    occurredAt: "2026-02-10T11:00:00Z",
  },
  {
    id: "a2",
    action: "secret_updated",
    actor: "admin@company.local",
    projectId: "apollo",
    secretName: "Vercel Deploy Hook",
    occurredAt: "2026-02-14T09:10:00Z",
  },
  {
    id: "a3",
    action: "secret_copied",
    actor: "member@company.local",
    projectId: "atlas",
    secretName: "Algolia Search",
    occurredAt: "2026-02-15T09:15:00Z",
  },
  {
    id: "a4",
    action: "secret_exported",
    actor: "admin@company.local",
    projectId: "apollo",
    secretName: "Apollo API",
    occurredAt: "2026-02-15T09:20:00Z",
  },
];
