import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth.api';
import { tokenStore } from '../api/tokenStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  // On first load, try to silently exchange the refresh cookie (if any)
  // for a fresh access token so a page refresh doesn't log the user out.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await authApi.refresh();
        if (cancelled) return;
        tokenStore.set(data.data.accessToken);
        setUser(data.data.user);
      } catch {
        tokenStore.clear();
        setUser(null);
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const { data } = await authApi.login({ email, password });
    tokenStore.set(data.data.accessToken);
    setUser(data.data.user);
    return data.data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await authApi.register(payload);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort - clear local state regardless of network outcome.
    } finally {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const { data } = await authApi.me();
    setUser(data.data.user);
    return data.data.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isBootstrapping,
      login,
      register,
      logout,
      refreshCurrentUser
    }),
    [user, isBootstrapping, login, register, logout, refreshCurrentUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
