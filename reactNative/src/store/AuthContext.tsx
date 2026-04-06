/**
 * Contexte d'authentification global.
 *
 * - `user === undefined`  → chargement initial (affiche un spinner)
 * - `user === null`       → non authentifié (redirige vers /login)
 * - `user === User`       → authentifié
 *
 * Le service auth sous-jacent bascule automatiquement entre SQLite (dev)
 * et l'API HTTP (prod) via IS_LOCAL dans `@/services/index`.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import * as authService from '@/services/auth';
import type { User, AuthCredentials } from '@/types';

interface AuthContextValue {
  user: User | null | undefined;
  login: (c: AuthCredentials) => Promise<void>;
  register: (c: AuthCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (u: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    authService.me().then(setUser).catch(() => setUser(null));
  }, []);

  const login = async (credentials: AuthCredentials) => {
    const u = await authService.login(credentials);
    setUser(u);
  };

  const register = async (credentials: AuthCredentials) => {
    const u = await authService.register(credentials);
    setUser(u);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const updateUser = (u: User) => setUser(u);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider');
  return ctx;
}
