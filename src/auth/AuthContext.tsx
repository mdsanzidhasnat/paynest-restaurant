import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, setUnauthorizedHandler, type AuthUser } from '../api/client';

export type Permission =
  | 'dashboard:read'
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'settings:read'
  | 'settings:write'
  | 'invoice-settings:read'
  | 'products:read'
  | 'products:write'
  | 'products:delete'
  | 'categories:read'
  | 'categories:write'
  | 'categories:delete'
  | 'inventory:read'
  | 'inventory:write'
  | 'customers:read'
  | 'customers:write'
  | 'customers:delete'
  | 'suppliers:read'
  | 'suppliers:write'
  | 'suppliers:delete'
  | 'purchases:read'
  | 'purchases:write'
  | 'purchases:delete'
  | 'sales:create'
  | 'sales:read'
  | 'sales:delete'
  | 'dues:read'
  | 'dues:write'
  | 'reports:read';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  forbiddenMessage: string;
  clearForbiddenMessage: () => void;
  showForbiddenMessage: (message?: string) => void;
  can: (permission: Permission) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbiddenMessage, setForbiddenMessage] = useState('');

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // The local session is always cleared even if the server call fails.
    }
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    api.me()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const clearForbiddenMessage = useCallback(() => setForbiddenMessage(''), []);
  const showForbiddenMessage = useCallback(
    (message?: string) => setForbiddenMessage(message ?? 'You do not have permission to do that.'),
    []
  );

  const can = useCallback(
    (permission: Permission) => Boolean(user?.permissions.includes(permission)),
    [user]
  );

  const login = useCallback(async (email: string, password: string) => {
    const currentUser = await api.login(email, password);
    setUser(currentUser);
    setForbiddenMessage('');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      forbiddenMessage,
      clearForbiddenMessage,
      showForbiddenMessage,
      can,
      login,
      logout,
    }),
    [user, loading, forbiddenMessage, clearForbiddenMessage, showForbiddenMessage, can, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function isApiForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}
