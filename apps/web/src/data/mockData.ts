import type { AuditEvent, Project, Secret, User } from "../types";

export const projects: Project[] = [
  { id: "apollo", name: "Apollo API", tags: ["payments", "critical"] },
  { id: "atlas", name: "Atlas Core", tags: ["backend"] },
  { id: "nova", name: "Nova Analytics", tags: ["data", "internal"] },
];

export const users: Record<string, User> = {
  admin: {
    id: "u-admin",
    name: "Aylin Admin",
    role: "admin",
    assignments: [
      { projectId: "apollo", prodAccess: true },
      { projectId: "atlas", prodAccess: true },
      { projectId: "nova", prodAccess: true },
    ],
  },
  member: {
    id: "u-member",
    name: "Deniz Dev",
    role: "member",
    assignments: [
      { projectId: "apollo", prodAccess: false },
      { projectId: "atlas", prodAccess: true },
    ],
  },
  viewer: {
    id: "u-viewer",
    name: "Mert Ops",
    role: "viewer",
    assignments: [{ projectId: "apollo", prodAccess: false }],
  },
};

export const secrets: Secret[] = [
  {
    id: "s1",
    projectId: "apollo",
    name: "Stripe Payments",
    provider: "Stripe",
    type: "key",
    environment: "prod",
    keyName: "STRIPE_API_KEY",
    valueMasked: "sk_live_...8Xy9",
    updatedAt: "2h ago",
    tags: ["billing", "prod"],
    notes: "Primary production key for billing.",
  },
  {
    id: "s2",
    projectId: "apollo",
    name: "Vercel Deploy Hook",
    provider: "Vercel",
    type: "endpoint",
    environment: "dev",
    keyName: "VERCEL_DEPLOY_HOOK",
    valueMasked: "https://api.ver...",
    updatedAt: "1d ago",
    tags: ["deploy"],
    notes: "Used for dev deploy trigger.",
  },
  {
    id: "s3",
    projectId: "atlas",
    name: "Algolia Search",
    provider: "Algolia",
    type: "token",
    environment: "dev",
    keyName: "ALGOLIA_SEARCH_KEY",
    valueMasked: "search_only_...a1b",
    updatedAt: "5d ago",
    tags: ["search"],
    notes: "Search key for Atlas index.",
  },
  {
    id: "s4",
    projectId: "atlas",
    name: "Auth Service URL",
    provider: "Internal",
    type: "endpoint",
    environment: "prod",
    keyName: "AUTH_SERVICE_URL",
    valueMasked: "https://auth...",
    updatedAt: "3d ago",
    tags: ["auth", "prod"],
    notes: "Backend auth endpoint.",
  },
  {
    id: "s5",
    projectId: "nova",
    name: "S3 Access Token",
    provider: "AWS",
    type: "token",
    environment: "local",
    keyName: "AWS_S3_TOKEN",
    valueMasked: "AKIA...9Z",
    updatedAt: "7d ago",
    tags: ["storage"],
    notes: "Local ingestion bucket token.",
  },
];

export const auditEvents: AuditEvent[] = [
  {
    id: "a1",
    action: "secret_updated",
    actor: "Aylin Admin",
    projectId: "apollo",
    secretName: "Stripe Payments",
    occurredAt: "2026-02-15 09:20",
  },
  {
    id: "a2",
    action: "secret_copied",
    actor: "Deniz Dev",
    projectId: "atlas",
    secretName: "Auth Service URL",
    occurredAt: "2026-02-15 10:03",
  },
  {
    id: "a3",
    action: "secret_exported",
    actor: "Aylin Admin",
    projectId: "apollo",
    secretName: "Apollo API",
    occurredAt: "2026-02-14 17:44",
  },
];
