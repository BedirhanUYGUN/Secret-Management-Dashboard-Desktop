import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { canAccessEnvironment, canAccessProject, getUserFromHeaders, requireRole } from "./auth.js";
import { auditEvents, projects, secrets } from "./data.js";
import { parseTxtImport } from "./importer.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true }));

app.get("/me", async (request) => {
  const user = getUserFromHeaders(request);
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    assignments: user.assignments,
  };
});

app.get("/projects", async (request, reply) => {
  const user = getUserFromHeaders(request);
  const result = projects
    .filter((project) => canAccessProject(user, project.id))
    .map((project) => {
      const keyCount = secrets.filter(
        (secret) =>
          secret.projectId === project.id && canAccessEnvironment(user, project.id, secret.environment),
      ).length;

      return {
        ...project,
        keyCount,
      };
    });
  return reply.send(result);
});

app.get("/projects/:projectId/secrets", async (request, reply) => {
  const user = getUserFromHeaders(request);
  const params = z.object({ projectId: z.string().min(1) }).parse(request.params);
  const query = z
    .object({
      env: z.enum(["local", "dev", "prod"]).optional(),
      provider: z.string().optional(),
      tag: z.string().optional(),
    })
    .parse(request.query);

  if (!canAccessProject(user, params.projectId)) {
    return reply.code(403).send({ message: "Forbidden" });
  }

  const result = secrets.filter((secret) => {
    if (secret.projectId !== params.projectId) {
      return false;
    }
    if (query.env && secret.environment !== query.env) {
      return false;
    }
    if (!canAccessEnvironment(user, params.projectId, secret.environment)) {
      return false;
    }
    if (query.provider && secret.provider !== query.provider) {
      return false;
    }
    if (query.tag && !secret.tags.includes(query.tag)) {
      return false;
    }
    return true;
  });

  return reply.send(result);
});

app.get("/search", async (request, reply) => {
  const user = getUserFromHeaders(request);
  const query = z
    .object({
      q: z.string().default(""),
      provider: z.string().optional(),
      tag: z.string().optional(),
    })
    .parse(request.query);

  const lowered = query.q.toLowerCase();
  const result = secrets.filter((secret) => {
    if (!canAccessProject(user, secret.projectId)) {
      return false;
    }
    if (!canAccessEnvironment(user, secret.projectId, secret.environment)) {
      return false;
    }
    if (query.provider && secret.provider !== query.provider) {
      return false;
    }
    if (query.tag && !secret.tags.includes(query.tag)) {
      return false;
    }
    const searchBlob = `${secret.name} ${secret.provider} ${secret.keyName} ${secret.tags.join(" ")}`.toLowerCase();
    return searchBlob.includes(lowered);
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
    preview: parsed.pairs.slice(0, 20),
  });
});

app.get("/exports/:projectId", async (request, reply) => {
  const user = getUserFromHeaders(request);
  const params = z.object({ projectId: z.string().min(1) }).parse(request.params);
  const query = z
    .object({
      env: z.enum(["local", "dev", "prod"]),
      format: z.enum(["env", "json"]),
    })
    .parse(request.query);

  if (!canAccessProject(user, params.projectId) || !canAccessEnvironment(user, params.projectId, query.env)) {
    return reply.code(403).send({ message: "Forbidden" });
  }

  const scopedSecrets = secrets.filter(
    (secret) => secret.projectId === params.projectId && secret.environment === query.env,
  );

  if (query.format === "env") {
    const envPayload = scopedSecrets.map((secret) => `${secret.keyName}=${secret.valueMasked}`).join("\n");
    return reply.type("text/plain").send(envPayload);
  }

  const jsonPayload = Object.fromEntries(scopedSecrets.map((secret) => [secret.keyName, secret.valueMasked]));
  return reply.send(jsonPayload);
});

app.get("/audit", async (request, reply) => {
  const user = getUserFromHeaders(request);
  if (!requireRole(user, ["admin"])) {
    return reply.code(403).send({ message: "Forbidden" });
  }

  return reply.send(auditEvents);
});

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: "0.0.0.0" });
