export type Role = "admin" | "member" | "viewer";

export type Environment = "local" | "dev" | "prod";

export type SecretType = "key" | "token" | "endpoint";

export type Project = {
  id: string;
  name: string;
  tags: string[];
};

export type Assignment = {
  projectId: string;
  prodAccess: boolean;
};

export type User = {
  id: string;
  name: string;
  role: Role;
  assignments: Assignment[];
};

export type Secret = {
  id: string;
  projectId: string;
  name: string;
  provider: string;
  type: SecretType;
  environment: Environment;
  keyName: string;
  valueMasked: string;
  updatedAt: string;
  tags: string[];
  notes: string;
};

export type AuditAction = "secret_created" | "secret_updated" | "secret_copied" | "secret_exported";

export type AuditEvent = {
  id: string;
  action: AuditAction;
  actor: string;
  projectId: string;
  secretName: string;
  occurredAt: string;
};
