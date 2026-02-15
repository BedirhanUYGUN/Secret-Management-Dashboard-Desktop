import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { getUserFromHeaders, requireRole } from "./auth.js";
import { parseTxtImport } from "./importer.js";
import {
  addAuditEvent,
  createSecret,
  createSecretVersion,
  deleteSecret,
  exportSecrets,
  findSecretByKey,
  getAssignmentsForUser,
  getProjectsForUser,
  getSecretDetailsForUser,
  hasEnvironmentAccess,
  hasProjectAccess,
  listAuditEvents,
  listSecrets,
  updateSecret,
} from "./store.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

const environmentSchema = z.enum(["local", "dev", "prod"]);
const secretTypeSchema = z.enum(["key", "token", "endpoint"]);

function keyToName(key: string) {
  return key
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

app.get("/health", async () => ({ ok: true }));

app.get("/me", async (request, reply) => {
  const user = getUserFromHeaders(request);
  const assignments = await getAssignmentsForUser(user.id);
  return reply.send({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    assignments,
  });
});

app.get("/projects", async (request, reply) => {
  const user = getUserFromHeaders(request);
  const result = await getProjectsForUser(user.id);
  return reply.send(result);
});

app.get("/projects/:projectId/secrets", async (request, reply) => {
  const user = getUserFromHeaders(request);
  const params = z.object({ projectId: z.string().min(1) }).parse(request.params);
  const query = z
    .object({
      env: environmentSchema.optional(),
      provider: z.string().optional(),
      tag: z.string().optional(),
      type: secretTypeSchema.optional(),
    })
    .parse(request.query);

  if (!(await hasProjectAccess(user.id, params.projectId))) {
    return reply.code(403).send({ message: "Forbidden" });
  }

  const result = await listSecrets({
    userId: user.id,
    projectId: params.projectId,
    environment: query.env,
    provider: query.provider,
    tag: query.tag,
    type: query.type,
  });
  return reply.send(result);
});

app.get("/secrets/:secretId/reveal", async (request, reply) => {
  const user = getUserFromHeaders(request);
  const params = z.object({ secretId: z.string().uuid() }).parse(request.params);
  const secret = await getSecretDetailsForUser(user.id, params.secretId);

  if (!secret) {
    return reply.code(404).send({ message: "Secret not found" });
  }

  return reply.send({
    secretId: secret.id,
    keyName: secret.key_name,
    value: secret.value_plain,
  });
});

app.post("/projects/:projectId/secrets", async (request, reply) => {
  const user = getUserFromHeaders(request);
  if (!requireRole(user, ["admin", "member"])) {
    return reply.code(403).send({ message: "Forbidden" });
  }

  const params = z.object({ projectId: z.string().min(1) }).parse(request.params);
  const body = z
    .object({
      name: z.string().min(1),
      provider: z.string().min(1),
      type: secretTypeSchema,
      environment: environmentSchema,
      keyName: z.string().min(1),
      value: z.string(),
      tags: z.array(z.string().min(1)).default([]),
      notes: z.string().default(""),
    })
    .parse(request.body);

  if (!(await hasEnvironmentAccess(user.id, params.projectId, body.environment))) {
    return reply.code(403).send({ message: "Forbidden" });
  }

  const created = await createSecret({
    userId: user.id,
    projectId: params.projectId,
    environment: body.environment,
    name: body.name,
    provider: body.provider,
    type: body.type,
    keyName: body.keyName,
    value: body.value,
    tags: body.tags,
    notes: body.notes,
  });

  if (!created) {
    return reply.code(400).send({ message: "Secret could not be created" });
  }

  await addAuditEvent({
    actorUserId: user.id,
    projectId: created.projectId,
    action: "secret_created",
    targetType: "secret",
    targetId: created.id,
    metadata: { secretName: created.name },
  });

  return reply.code(201).send(created);
});

app.patch("/secrets/:secretId", async (request, reply) => {
  const user = getUserFromHeaders(request);
  if (!requireRole(user, ["admin", "member"])) {
    return reply.code(403).send({ message: "Forbidden" });
  }

  const params = z.object({ secretId: z.string().uuid() }).parse(request.params);
  const body = z
    .object({
      name: z.string().min(1).optional(),
      provider: z.string().min(1).optional(),
      type: secretTypeSchema.optional(),
      keyName: z.string().min(1).optional(),
      value: z.string().optional(),
      tags: z.array(z.string().min(1)).optional(),
      notes: z.string().optional(),
    })
    .parse(request.body);

  const updated = await updateSecret({
    userId: user.id,
    secretId: params.secretId,
    name: body.name,
    provider: body.provider,
    type: body.type,
    keyName: body.keyName,
    value: body.value,
    tags: body.tags,
    notes: body.notes,
  });

  if (!updated) {
    return reply.code(404).send({ message: "Secret not found" });
  }

  await addAuditEvent({
    actorUserId: user.id,
    projectId: updated.projectId,
    action: "secret_updated",
    targetType: "secret",
    targetId: updated.id,
    metadata: { secretName: updated.name },
  });

  return reply.send(updated);
});

app.delete("/secrets/:secretId", async (request, reply) => {
  const user = getUserFromHeaders(request);
  if (!requireRole(user, ["admin"])) {
    return reply.code(403).send({ message: "Forbidden" });
  }

  const params = z.object({ secretId: z.string().uuid() }).parse(request.params);
  const deleted = await deleteSecret({ userId: user.id, secretId: params.secretId });

  if (!deleted) {
    return reply.code(404).send({ message: "Secret not found" });
  }

  await addAuditEvent({
    actorUserId: user.id,
    projectId: deleted.projectId,
    action: "secret_updated",
    targetType: "secret",
    metadata: { secretName: deleted.name, event: "deleted" },
  });

  return reply.code(204).send();
});

app.get("/search", async (request, reply) => {
  const user = getUserFromHeaders(request);
  const query = z
    .object({
      q: z.string().default(""),
      provider: z.string().optional(),
      tag: z.string().optional(),
      environment: environmentSchema.optional(),
      type: secretTypeSchema.optional(),
    })
    .parse(request.query);

  const result = await listSecrets({
    userId: user.id,
    projectId: undefined,
    q: query.q,
    provider: query.provider,
    tag: query.tag,
    environment: query.environment,
    type: query.type,
  });

  return reply.send(result);
});

app.post("/imports/preview", async (request, reply) => {
  const user = getUserFromHeaders(request);
  if (!requireRole(user, ["admin"])) {
    return reply.code(403).send({ message: "Forbidden" });
  }

  const body = z.object({ content: z.string().min(1) }).parse(request.body);
  const parsed = parseTxtImport(body.content);

  return reply.send({
    heading: parsed.projectHeading,
    totalPairs: parsed.pairs.length,
    skipped: parsed.skipped,
    preview: parsed.pairs.slice(0, 50),
  });
});

app.post("/imports/commit", async (request, reply) => {
  const user = getUserFromHeaders(request);
  if (!requireRole(user, ["admin"])) {
    return reply.code(403).send({ message: "Forbidden" });
  }

  const body = z
    .object({
      projectId: z.string().min(1),
      environment: environmentSchema,
      content: z.string().min(1),
      provider: z.string().default("Imported"),
      type: secretTypeSchema.default("key"),
      conflictStrategy: z.enum(["skip", "overwrite", "new_version"]).default("skip"),
      tags: z.array(z.string()).default([]),
    })
    .parse(request.body);

  if (!(await hasEnvironmentAccess(user.id, body.projectId, body.environment))) {
    return reply.code(403).send({ message: "Forbidden" });
  }

  const parsed = parseTxtImport(body.content);
  let inserted = 0;
  let updated = 0;
  let skipped = parsed.skipped;

  for (const pair of parsed.pairs) {
    const existing = await findSecretByKey({
      userId: user.id,
      projectId: body.projectId,
      environment: body.environment,
      keyName: pair.key,
    });

    if (!existing) {
      const created = await createSecret({
        userId: user.id,
        projectId: body.projectId,
        environment: body.environment,
        name: keyToName(pair.key),
        provider: body.provider,
        type: body.type,
        keyName: pair.key,
        value: pair.value,
        tags: body.tags,
        notes: "Imported from TXT",
      });
      if (created) {
        inserted += 1;
      }
      continue;
    }

    if (body.conflictStrategy === "skip") {
      skipped += 1;
      continue;
    }

    if (body.conflictStrategy === "new_version") {
      await createSecretVersion({ secretId: existing.id, userId: user.id });
    }

    const changed = await updateSecret({
      userId: user.id,
      secretId: existing.id,
      value: pair.value,
      provider: body.provider,
      type: body.type,
    });
    if (changed) {
      updated += 1;
    }
  }

  await addAuditEvent({
    actorUserId: user.id,
    projectId: body.projectId,
    action: "secret_updated",
    targetType: "import",
    metadata: {
      secretName: `Import ${body.environment.toUpperCase()}`,
      inserted,
      updated,
      skipped,
      conflictStrategy: body.conflictStrategy,
    },
  });

  return reply.send({
    projectId: body.projectId,
    environment: body.environment,
    inserted,
    updated,
    skipped,
    total: parsed.pairs.length,
  });
});

app.get("/exports/:projectId", async (request, reply) => {
  const user = getUserFromHeaders(request);
  if (user.role === "viewer") {
    return reply.code(403).send({ message: "Viewer cannot export by default" });
  }

  const params = z.object({ projectId: z.string().min(1) }).parse(request.params);
  const query = z
    .object({
      env: environmentSchema,
      format: z.enum(["env", "json"]),
    })
    .parse(request.query);

  if (!(await hasEnvironmentAccess(user.id, params.projectId, query.env))) {
    return reply.code(403).send({ message: "Forbidden" });
  }

  const scopedSecrets = await exportSecrets({
    userId: user.id,
    projectId: params.projectId,
    environment: query.env,
  });

  await addAuditEvent({
    actorUserId: user.id,
    projectId: params.projectId,
    action: "secret_exported",
    targetType: "project",
    metadata: {
      secretName: `${params.projectId}:${query.env}`,
      format: query.format,
      count: scopedSecrets.length,
    },
  });

  if (query.format === "env") {
    const envPayload = scopedSecrets.map((secret) => `${secret.key_name}=${secret.value_plain}`).join("\n");
    return reply.type("text/plain").send(envPayload);
  }

  const jsonPayload = Object.fromEntries(scopedSecrets.map((secret) => [secret.key_name, secret.value_plain]));
  return reply.type("application/json").send(JSON.stringify(jsonPayload, null, 2));
});

app.post("/audit/copy", async (request, reply) => {
  const user = getUserFromHeaders(request);
  const body = z
    .object({
      projectId: z.string().min(1).optional(),
      secretId: z.string().uuid(),
    })
    .parse(request.body);

  const secret = await getSecretDetailsForUser(user.id, body.secretId);
  if (!secret) {
    return reply.code(404).send({ message: "Secret not found" });
  }

  const projectId = body.projectId ?? secret.project_id;
  if (!(await hasProjectAccess(user.id, projectId))) {
    return reply.code(403).send({ message: "Forbidden" });
  }

  await addAuditEvent({
    actorUserId: user.id,
    projectId,
    action: "secret_copied",
    targetType: "secret",
    targetId: secret.id,
    metadata: { secretName: secret.name },
  });

  return reply.code(201).send({ ok: true });
});

app.get("/audit", async (request, reply) => {
  const user = getUserFromHeaders(request);
  if (!requireRole(user, ["admin"])) {
    return reply.code(403).send({ message: "Forbidden" });
  }

  const query = z
    .object({
      action: z.string().optional(),
      projectId: z.string().optional(),
      userEmail: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .parse(request.query);

  const rows = await listAuditEvents(query);
  return reply.send(rows);
});

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: "0.0.0.0" });
