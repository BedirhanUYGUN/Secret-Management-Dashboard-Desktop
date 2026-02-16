import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { fetchMe, loginByRole, logoutSession } from "../api/client";
import type { Role, User } from "../types";

type AuthContextValue = {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  loginAsRole: (role: Role) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: user !== null,
      user,
      loading,
      loginAsRole: async (role: Role) => {
        setLoading(true);
        try {
          await loginByRole(role);
          const profile = await fetchMe(role);
          setUser(profile);
        } finally {
          setLoading(false);
        }
      },
      logout: () => {
        const role = user?.role;
        if (role) {
          void logoutSession(role);
        }
        setUser(null);
      },
    }),
    [loading, user],
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
