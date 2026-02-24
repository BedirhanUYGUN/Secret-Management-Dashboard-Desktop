import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { clearTokens, fetchMe, loginWithCredentials, logoutSession } from "../api/client";
import { hasStoredAccessToken } from "../platform/tokenStorage";
import type { User } from "../types";

type AuthContextValue = {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Sayfa yenilendiginde mevcut token ile oturum kontrolu
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const hasToken = await hasStoredAccessToken();
      if (!hasToken) {
        if (!cancelled) {
          setInitializing(false);
        }
        return;
      }

      try {
        const profile = await fetchMe();
        if (!cancelled) {
          setUser(profile);
        }
      } catch {
        await clearTokens();
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
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
      refreshUser: async () => {
        const profile = await fetchMe();
        setUser(profile);
      },
    }),
    [loading, initializing, user],
  );

  if (initializing) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div className="spinner-container">
          <div className="spinner" />
          <span className="spinner-text">Oturum kontrol ediliyor...</span>
        </div>
      </div>
    );
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
