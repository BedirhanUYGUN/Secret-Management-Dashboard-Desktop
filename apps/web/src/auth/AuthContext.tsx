import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { users } from "../data/mockData";
import type { Role, User } from "../types";

type AuthContextValue = {
  isAuthenticated: boolean;
  user: User | null;
  loginAsRole: (role: Role) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const roleToUserKey: Record<Role, keyof typeof users> = {
  admin: "admin",
  member: "member",
  viewer: "viewer",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(users.admin);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: user !== null,
      user,
      loginAsRole: (role: Role) => setUser(users[roleToUserKey[role]]),
      logout: () => setUser(null),
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
