import type { FastifyRequest } from "fastify";
import { users } from "./data.js";
import type { Role, User } from "./data.js";

export function getUserFromHeaders(request: FastifyRequest): User {
  const requestedRole = request.headers["x-user-role"];
  const requestedEmail = request.headers["x-user-email"];

  const byEmail = typeof requestedEmail === "string" ? users.find((user) => user.email === requestedEmail) : undefined;
  if (byEmail) {
    return byEmail;
  }

  if (requestedRole === "admin" || requestedRole === "member" || requestedRole === "viewer") {
    const byRole = users.find((user) => user.role === requestedRole);
    if (byRole) {
      return byRole;
    }
  }

  return users[0];
}

export function requireRole(user: User, allowedRoles: Role[]) {
  return allowedRoles.includes(user.role);
}

export function canAccessProject(user: User, projectId: string) {
  return user.assignments.some((assignment) => assignment.projectId === projectId);
}

export function canAccessEnvironment(user: User, projectId: string, environment: "local" | "dev" | "prod") {
  const assignment = user.assignments.find((item) => item.projectId === projectId);
  if (!assignment) {
    return false;
  }
  if (environment === "prod") {
    return assignment.prodAccess;
  }
  return true;
}
