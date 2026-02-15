import type { FastifyRequest } from "fastify";

export type Role = "admin" | "member" | "viewer";

export type MockUser = {
  id: string;
  email: string;
  role: Role;
  name: string;
};

const mockUsers: Record<Role, MockUser> = {
  admin: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@company.local",
    role: "admin",
    name: "Aylin Admin",
  },
  member: {
    id: "22222222-2222-4222-8222-222222222222",
    email: "member@company.local",
    role: "member",
    name: "Deniz Dev",
  },
  viewer: {
    id: "33333333-3333-4333-8333-333333333333",
    email: "viewer@company.local",
    role: "viewer",
    name: "Mert Ops",
  },
};

export function getUserFromHeaders(request: FastifyRequest): MockUser {
  const requestedRole = request.headers["x-user-role"];
  const requestedEmail = request.headers["x-user-email"];

  if (typeof requestedEmail === "string") {
    const byEmail = Object.values(mockUsers).find((user) => user.email === requestedEmail);
    if (byEmail) {
      return byEmail;
    }
  }

  if (requestedRole === "admin" || requestedRole === "member" || requestedRole === "viewer") {
    return mockUsers[requestedRole];
  }

  return mockUsers.admin;
}

export function requireRole(user: MockUser, allowedRoles: Role[]) {
  return allowedRoles.includes(user.role);
}
