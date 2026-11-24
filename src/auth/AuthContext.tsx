import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  api,
  ApiError,
  setForbiddenHandler,
  setUnauthorizedHandler,
  type AuthUser,
} from '../api/client';
import type { Permission } from '../../server/permissions';

export type { Permission };

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
    setForbiddenHandler((message) => {
      setForbiddenMessage(message || 'You do not have permission to do that.');
    });
    return () => {
      setUnauthorizedHandler(null);
      setForbiddenHandler(null);
    };
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
