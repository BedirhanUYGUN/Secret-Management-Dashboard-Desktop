import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { clearTokens, fetchMe, loginWithCredentials, logoutSession } from "../api/client";
import type { User } from "../types";

type AuthContextValue = {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const ACCESS_TOKEN_KEY = "api-key-organizer-access-token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Sayfa yenilendiginde mevcut token ile oturum kontrolu
  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      setInitializing(false);
      return;
    }

    fetchMe()
      .then(setUser)
      .catch(() => {
        clearTokens();
      })
      .finally(() => setInitializing(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: user !== null,
      user,
      loading: loading || initializing,
      login: async (email: string, password: string) => {
        setLoading(true);
        try {
          await loginWithCredentials(email, password);
          const profile = await fetchMe();
          setUser(profile);
        } finally {
          setLoading(false);
        }
      },
      logout: () => {
        void logoutSession();
        setUser(null);
      },
    }),
    [loading, initializing, user],
  );

  if (initializing) {
    return null;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
