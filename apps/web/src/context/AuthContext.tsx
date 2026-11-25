import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, type AuthUser } from "../services/api.js";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  register: (role: "STUDENT" | "ADMIN", data: Record<string, string>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    setError(null);
    try {
      const session = await api.getAuthSession();
      setUser(session.isAuthenticated ? session.user : null);
    } catch (sessionError) {
      setUser(null);
      setError(sessionError instanceof Error ? sessionError.message : "Could not restore your sign-in session.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    const result = await api.login(email, password, rememberMe);
    setUser(result.user);
    setError(null);
  }, []);

  const register = useCallback(async (role: "STUDENT" | "ADMIN", data: Record<string, string>) => {
    const result = await api.register(role, data);
    setUser(result.user);
    setError(null);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setError(null);
  }, []);

  const value = useMemo(() => ({ user, loading, error, login, register, logout }), [
    user,
    loading,
    error,
    login,
    register,
    logout,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
