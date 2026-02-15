import type { PoolClient } from "pg";
import { query, withTransaction } from "./db/client.js";

export type EnvironmentName = "local" | "dev" | "prod";
export type SecretType = "key" | "token" | "endpoint";

export type ProjectSummary = {
  id: string;
  name: string;
  tags: string[];
  keyCount: number;
  prodAccess: boolean;
};

export type SecretRecord = {
  id: string;
  projectId: string;
  name: string;
  provider: string;
  type: SecretType;
  environment: EnvironmentName;
  keyName: string;
  valueMasked: string;
  updatedAt: string;
  tags: string[];
  notes: string;
};

type SecretRawRow = {
  id: string;
  project_id: string;
  name: string;
  provider: string;
  type: SecretType;
  environment: EnvironmentName;
  key_name: string;
  value_plain: string;
  updated_at: Date;
  tags: string[] | null;
  notes: string | null;
};

export type Assignment = {
  projectId: string;
  prodAccess: boolean;
};

export type AuditEventRecord = {
  id: string;
  action: string;
  actor: string;
  projectId: string;
  secretName: string;
  occurredAt: string;
};

export function maskSecretValue(value: string) {
  if (value.length <= 6) {
    return "*".repeat(Math.max(value.length, 3));
  }
  const head = value.slice(0, 4);
  const tail = value.slice(-4);
  return `${head}...${tail}`;
}

function toSecretRecord(row: SecretRawRow): SecretRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    provider: row.provider,
    type: row.type,
    environment: row.environment,
    keyName: row.key_name,
    valueMasked: maskSecretValue(row.value_plain),
    updatedAt: row.updated_at.toISOString(),
    tags: row.tags ?? [],
    notes: row.notes ?? "",
  };
}

export async function getAssignmentsForUser(userId: string): Promise<Assignment[]> {
  const result = await query<{
    project_id: string;
    prod_access: boolean;
  }>(
    `
      SELECT
        p.slug AS project_id,
        COALESCE(MAX(CASE WHEN e.name = 'prod' THEN ea.can_read::int ELSE 0 END), 0) = 1 AS prod_access
      FROM project_members pm
      JOIN projects p ON p.id = pm.project_id
      LEFT JOIN environments e ON e.project_id = p.id
      LEFT JOIN environment_access ea ON ea.environment_id = e.id AND ea.user_id = pm.user_id
      WHERE pm.user_id = $1
      GROUP BY p.slug
      ORDER BY p.slug
    `,
    [userId],
  );

  return result.rows.map((row) => ({
    projectId: row.project_id,
    prodAccess: row.prod_access,
  }));
}

export async function getProjectsForUser(userId: string): Promise<ProjectSummary[]> {
  const result = await query<{
    id: string;
    name: string;
    tags: string[] | null;
    key_count: number;
    prod_access: boolean;
  }>(
    `
      SELECT
        p.slug AS id,
        p.name,
        COALESCE(tags.tags, '{}'::text[]) AS tags,
        COALESCE(stats.key_count, 0)::int AS key_count,
        COALESCE(prod.prod_access, FALSE) AS prod_access
      FROM project_members pm
      JOIN projects p ON p.id = pm.project_id
      LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(pt.tag ORDER BY pt.tag) AS tags
        FROM project_tags pt
        WHERE pt.project_id = p.id
      ) tags ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS key_count
        FROM secrets s
        JOIN environments e ON e.id = s.environment_id
        LEFT JOIN environment_access ea ON ea.environment_id = e.id AND ea.user_id = pm.user_id
        WHERE s.project_id = p.id
          AND (e.name <> 'prod' OR COALESCE(ea.can_read, FALSE))
      ) stats ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(ea.can_read, FALSE) AS prod_access
        FROM environments e
        LEFT JOIN environment_access ea ON ea.environment_id = e.id AND ea.user_id = pm.user_id
        WHERE e.project_id = p.id AND e.name = 'prod'
        LIMIT 1
      ) prod ON TRUE
      WHERE pm.user_id = $1
      ORDER BY p.name
    `,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    tags: row.tags ?? [],
    keyCount: Number(row.key_count),
    prodAccess: row.prod_access,
  }));
}

export async function hasProjectAccess(userId: string, projectId: string) {
  const result = await query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM project_members pm
        JOIN projects p ON p.id = pm.project_id
        WHERE pm.user_id = $1 AND p.slug = $2
      ) AS exists
    `,
    [userId, projectId],
  );

  return Boolean(result.rows[0]?.exists);
}

export async function hasEnvironmentAccess(userId: string, projectId: string, environment: EnvironmentName) {
  const result = await query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM project_members pm
        JOIN projects p ON p.id = pm.project_id
        JOIN environments e ON e.project_id = p.id
        LEFT JOIN environment_access ea ON ea.environment_id = e.id AND ea.user_id = pm.user_id
        WHERE pm.user_id = $1
          AND p.slug = $2
          AND e.name = $3
          AND (e.name <> 'prod' OR COALESCE(ea.can_read, FALSE))
      ) AS exists
    `,
    [userId, projectId, environment],
  );

  return Boolean(result.rows[0]?.exists);
}

export async function listSecrets(params: {
  userId: string;
  projectId?: string;
  environment?: EnvironmentName;
  provider?: string;
  tag?: string;
  type?: SecretType;
  q?: string;
}): Promise<SecretRecord[]> {
  const values: unknown[] = [params.userId];
  const clauses = ["pm.user_id = $1"];

  if (params.projectId && params.projectId !== "") {
    values.push(params.projectId);
    clauses.push(`p.slug = $${values.length}`);
  }
  if (params.environment) {
    values.push(params.environment);
    clauses.push(`e.name = $${values.length}`);
  }
  if (params.provider) {
    values.push(params.provider);
    clauses.push(`s.provider = $${values.length}`);
  }
  if (params.type) {
    values.push(params.type);
    clauses.push(`s.type = $${values.length}`);
  }
  if (params.tag) {
    values.push(params.tag);
    clauses.push(`EXISTS (SELECT 1 FROM secret_tags st WHERE st.secret_id = s.id AND st.tag = $${values.length})`);
  }
  if (params.q && params.q.trim() !== "") {
    values.push(`%${params.q.trim().toLowerCase()}%`);
    const token = `$${values.length}`;
    clauses.push(
      `(LOWER(s.name) LIKE ${token} OR LOWER(s.provider) LIKE ${token} OR LOWER(s.key_name) LIKE ${token} OR EXISTS (SELECT 1 FROM secret_tags st WHERE st.secret_id = s.id AND LOWER(st.tag) LIKE ${token}))`,
    );
  }

  const result = await query<SecretRawRow>(
    `
      SELECT
        s.id,
        p.slug AS project_id,
        s.name,
        s.provider,
        s.type,
        e.name AS environment,
        s.key_name,
        convert_from(s.value_encrypted, 'UTF8') AS value_plain,
        s.updated_at,
        COALESCE(tags.tags, '{}'::text[]) AS tags,
        sn.content AS notes
      FROM secrets s
      JOIN projects p ON p.id = s.project_id
      JOIN project_members pm ON pm.project_id = p.id
      JOIN environments e ON e.id = s.environment_id
      LEFT JOIN environment_access ea ON ea.environment_id = e.id AND ea.user_id = pm.user_id
      LEFT JOIN secret_notes sn ON sn.secret_id = s.id
      LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(st.tag ORDER BY st.tag) AS tags
        FROM secret_tags st
        WHERE st.secret_id = s.id
      ) tags ON TRUE
      WHERE ${clauses.join(" AND ")}
        AND (e.name <> 'prod' OR COALESCE(ea.can_read, FALSE))
      ORDER BY s.updated_at DESC
    `,
    values,
  );

  return result.rows.map(toSecretRecord);
}

export async function getSecretDetailsForUser(userId: string, secretId: string) {
  const result = await query<SecretRawRow>(
    `
      SELECT
        s.id,
        p.slug AS project_id,
        s.name,
        s.provider,
        s.type,
        e.name AS environment,
        s.key_name,
        convert_from(s.value_encrypted, 'UTF8') AS value_plain,
        s.updated_at,
        COALESCE(tags.tags, '{}'::text[]) AS tags,
        sn.content AS notes
      FROM secrets s
      JOIN projects p ON p.id = s.project_id
      JOIN project_members pm ON pm.project_id = p.id
      JOIN environments e ON e.id = s.environment_id
      LEFT JOIN environment_access ea ON ea.environment_id = e.id AND ea.user_id = pm.user_id
      LEFT JOIN secret_notes sn ON sn.secret_id = s.id
      LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(st.tag ORDER BY st.tag) AS tags
        FROM secret_tags st
        WHERE st.secret_id = s.id
      ) tags ON TRUE
      WHERE s.id = $1
        AND pm.user_id = $2
        AND (e.name <> 'prod' OR COALESCE(ea.can_read, FALSE))
      LIMIT 1
    `,
    [secretId, userId],
  );

  return result.rows[0] ?? null;
}

async function getProjectAndEnvironmentIds(client: PoolClient, projectId: string, environment: EnvironmentName) {
  const result = await client.query<{
    project_db_id: string;
    environment_db_id: string;
  }>(
    `
      SELECT
        p.id AS project_db_id,
        e.id AS environment_db_id
      FROM projects p
      JOIN environments e ON e.project_id = p.id
      WHERE p.slug = $1 AND e.name = $2
      LIMIT 1
    `,
    [projectId, environment],
  );

  return result.rows[0] ?? null;
}

async function replaceSecretTags(client: PoolClient, secretId: string, tags: string[]) {
  await client.query("DELETE FROM secret_tags WHERE secret_id = $1", [secretId]);
  for (const tag of tags) {
    await client.query(
      `
        INSERT INTO secret_tags (secret_id, tag)
        VALUES ($1, $2)
        ON CONFLICT (secret_id, tag) DO NOTHING
      `,
      [secretId, tag],
    );
  }
}

async function upsertSecretNote(client: PoolClient, params: { secretId: string; notes: string; userId: string }) {
  await client.query(
    `
      INSERT INTO secret_notes (secret_id, content, updated_by, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (secret_id)
      DO UPDATE SET content = EXCLUDED.content, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    `,
    [params.secretId, params.notes, params.userId],
  );
}

export async function createSecret(params: {
  userId: string;
  projectId: string;
  environment: EnvironmentName;
  name: string;
  provider: string;
  type: SecretType;
  keyName: string;
  value: string;
  tags: string[];
  notes: string;
}) {
  const secretId = await withTransaction(async (client) => {
    const ids = await getProjectAndEnvironmentIds(client, params.projectId, params.environment);
    if (!ids) {
      return null;
    }

    const insert = await client.query<{ id: string }>(
      `
        INSERT INTO secrets
          (project_id, environment_id, name, provider, type, key_name, value_encrypted, created_by, updated_by, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, convert_to($7, 'UTF8'), $8, $8, NOW())
        RETURNING id
      `,
      [
        ids.project_db_id,
        ids.environment_db_id,
        params.name,
        params.provider,
        params.type,
        params.keyName,
        params.value,
        params.userId,
      ],
    );

    const insertedSecretId = insert.rows[0]?.id;
    if (!insertedSecretId) {
      return null;
    }

    await replaceSecretTags(client, insertedSecretId, params.tags);
    await upsertSecretNote(client, { secretId: insertedSecretId, notes: params.notes, userId: params.userId });

    return insertedSecretId;
  });

  if (!secretId) {
    return null;
  }

  const created = await getSecretDetailsForUser(params.userId, secretId);
  return created ? toSecretRecord(created) : null;
}

export async function updateSecret(params: {
  userId: string;
  secretId: string;
  name?: string;
  provider?: string;
  type?: SecretType;
  keyName?: string;
  value?: string;
  tags?: string[];
  notes?: string;
}) {
  const existing = await getSecretDetailsForUser(params.userId, params.secretId);
  if (!existing) {
    return null;
  }

  await withTransaction(async (client) => {

    await client.query(
      `
        UPDATE secrets
        SET
          name = $2,
          provider = $3,
          type = $4,
          key_name = $5,
          value_encrypted = convert_to($6, 'UTF8'),
          updated_by = $7,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        params.secretId,
        params.name ?? existing.name,
        params.provider ?? existing.provider,
        params.type ?? existing.type,
        params.keyName ?? existing.key_name,
        params.value ?? existing.value_plain,
        params.userId,
      ],
    );

    if (params.tags) {
      await replaceSecretTags(client, params.secretId, params.tags);
    }
    if (params.notes !== undefined) {
      await upsertSecretNote(client, { secretId: params.secretId, notes: params.notes, userId: params.userId });
    }

    return params.secretId;
  });

  const updated = await getSecretDetailsForUser(params.userId, params.secretId);
  return updated ? toSecretRecord(updated) : null;
}

export async function deleteSecret(params: { userId: string; secretId: string }) {
  const existing = await getSecretDetailsForUser(params.userId, params.secretId);
  if (!existing) {
    return null;
  }

  await withTransaction(async (client) => {
    await client.query("DELETE FROM secrets WHERE id = $1", [params.secretId]);
  });

  return {
    projectId: existing.project_id,
    name: existing.name,
  };
}

export async function findSecretByKey(params: {
  userId: string;
  projectId: string;
  environment: EnvironmentName;
  keyName: string;
}) {
  const result = await query<SecretRawRow>(
    `
      SELECT
        s.id,
        p.slug AS project_id,
        s.name,
        s.provider,
        s.type,
        e.name AS environment,
        s.key_name,
        convert_from(s.value_encrypted, 'UTF8') AS value_plain,
        s.updated_at,
        COALESCE(tags.tags, '{}'::text[]) AS tags,
        sn.content AS notes
      FROM secrets s
      JOIN projects p ON p.id = s.project_id
      JOIN project_members pm ON pm.project_id = p.id
      JOIN environments e ON e.id = s.environment_id
      LEFT JOIN environment_access ea ON ea.environment_id = e.id AND ea.user_id = pm.user_id
      LEFT JOIN secret_notes sn ON sn.secret_id = s.id
      LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(st.tag ORDER BY st.tag) AS tags
        FROM secret_tags st
        WHERE st.secret_id = s.id
      ) tags ON TRUE
      WHERE pm.user_id = $1
        AND p.slug = $2
        AND e.name = $3
        AND s.key_name = $4
        AND (e.name <> 'prod' OR COALESCE(ea.can_read, FALSE))
      LIMIT 1
    `,
    [params.userId, params.projectId, params.environment, params.keyName],
  );

  return result.rows[0] ?? null;
}

export async function createSecretVersion(params: { secretId: string; userId: string }) {
  await query(
    `
      INSERT INTO secret_versions (secret_id, version, value_encrypted, created_by)
      SELECT
        s.id,
        COALESCE(MAX(sv.version), 0) + 1,
        s.value_encrypted,
        $2
      FROM secrets s
      LEFT JOIN secret_versions sv ON sv.secret_id = s.id
      WHERE s.id = $1
      GROUP BY s.id, s.value_encrypted
    `,
    [params.secretId, params.userId],
  );
}

export async function exportSecrets(params: {
  userId: string;
  projectId: string;
  environment: EnvironmentName;
}) {
  const result = await query<{
    key_name: string;
    value_plain: string;
  }>(
    `
      SELECT
        s.key_name,
        convert_from(s.value_encrypted, 'UTF8') AS value_plain
      FROM secrets s
      JOIN projects p ON p.id = s.project_id
      JOIN project_members pm ON pm.project_id = p.id
      JOIN environments e ON e.id = s.environment_id
      LEFT JOIN environment_access ea ON ea.environment_id = e.id AND ea.user_id = pm.user_id
      WHERE pm.user_id = $1
        AND p.slug = $2
        AND e.name = $3
        AND (e.name <> 'prod' OR COALESCE(ea.can_read, FALSE))
      ORDER BY s.key_name
    `,
    [params.userId, params.projectId, params.environment],
  );

  return result.rows;
}

export async function addAuditEvent(params: {
  actorUserId: string;
  projectId: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  const projectResult = await query<{ id: string }>("SELECT id FROM projects WHERE slug = $1 LIMIT 1", [params.projectId]);
  const projectDbId = projectResult.rows[0]?.id ?? null;

  await query(
    `
      INSERT INTO audit_events (project_id, actor_user_id, action, target_type, target_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [projectDbId, params.actorUserId, params.action, params.targetType, params.targetId ?? null, params.metadata ?? {}],
  );
}

export async function listAuditEvents(params: {
  action?: string;
  projectId?: string;
  userEmail?: string;
  from?: string;
  to?: string;
}): Promise<AuditEventRecord[]> {
  const values: unknown[] = [];
  const clauses: string[] = ["1=1"];

  if (params.action) {
    values.push(params.action);
    clauses.push(`ae.action = $${values.length}`);
  }
  if (params.projectId) {
    values.push(params.projectId);
    clauses.push(`p.slug = $${values.length}`);
  }
  if (params.userEmail) {
    values.push(params.userEmail);
    clauses.push(`u.email = $${values.length}`);
  }
  if (params.from) {
    values.push(params.from);
    clauses.push(`ae.created_at >= $${values.length}::timestamptz`);
  }
  if (params.to) {
    values.push(params.to);
    clauses.push(`ae.created_at <= $${values.length}::timestamptz`);
  }

  const result = await query<{
    id: string;
    action: string;
    actor: string | null;
    project_id: string | null;
    secret_name: string | null;
    occurred_at: Date;
  }>(
    `
      SELECT
        ae.id,
        ae.action,
        u.email AS actor,
        p.slug AS project_id,
        COALESCE(ae.metadata->>'secretName', '') AS secret_name,
        ae.created_at AS occurred_at
      FROM audit_events ae
      LEFT JOIN users u ON u.id = ae.actor_user_id
      LEFT JOIN projects p ON p.id = ae.project_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY ae.created_at DESC
      LIMIT 200
    `,
    values,
  );

  return result.rows.map((row) => ({
    id: row.id,
    action: row.action,
    actor: row.actor ?? "unknown",
    projectId: row.project_id ?? "unknown",
    secretName: row.secret_name ?? "",
    occurredAt: row.occurred_at.toISOString(),
  }));
}
