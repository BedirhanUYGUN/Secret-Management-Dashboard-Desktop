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

export type UserPreferences = {
  maskValues?: boolean;
  clipboardSeconds?: number;
};

export type User = {
  id: string;
  name: string;
  role: Role;
  assignments: Assignment[];
  preferences: UserPreferences;
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
  updatedByName: string | null;
  lastCopiedAt: string | null;
};

export type ManagedUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
};

export type ProjectDetail = {
  id: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
  members: ProjectMemberOut[];
};

export type ProjectMemberOut = {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
};

export type AuditAction = "secret_created" | "secret_updated" | "secret_deleted" | "secret_copied" | "secret_exported";

export type AuditEvent = {
  id: string;
  action: AuditAction;
  actor: string;
  projectId: string;
  secretName: string;
  occurredAt: string;
};
