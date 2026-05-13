import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  me,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
} from '../api/auth';
import {
  verifyChallenge,
  cancelChallenge,
  sendChallengeEmail,
} from '../api/mfa';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [mfaChallenge, setMfaChallenge] = useState(null);

  useEffect(() => {
    me().then(setUser).catch(() => setUser(null));
  }, []);

  // useCallback : les consumers passent ces handlers en deps de useEffect.
  // Sans stabilisation, leurs effets re-run à chaque render du provider.
  const login = useCallback(async (credentials) => {
    const res = await apiLogin(credentials);
    if (res && res.mfaRequired) {
      setMfaChallenge({ methods: res.methods, email: maskEmail(credentials.email) });
      return res;
    }
    setUser(res);
    return res;
  }, []);

  const register = useCallback((credentials) => apiRegister(credentials), []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setMfaChallenge(null);
  }, []);

  const updateUser = useCallback((u) => setUser(u), []);

  const verifyMfa = useCallback(async (method, code) => {
    const u = await verifyChallenge(method, code);
    setMfaChallenge(null);
    setUser(u);
    return u;
  }, []);

  const cancelMfa = useCallback(async () => {
    try { await cancelChallenge(); } catch { /* idempotent */ }
    setMfaChallenge(null);
  }, []);

  const sendMfaEmail = useCallback(() => sendChallengeEmail(), []);

  // useMemo sur la value : sans ça, l'objet `{...}` est neuf à chaque render
  // et tous les consumers de useAuth re-rendent — même ceux qui ne lisent que `user`.
  const value = useMemo(
    () => ({
      user, mfaChallenge,
      login, register, logout, updateUser,
      verifyMfa, cancelMfa, sendMfaEmail,
    }),
    [user, mfaChallenge, login, register, logout, updateUser, verifyMfa, cancelMfa, sendMfaEmail],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  const masked = local.length <= 2 ? local : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${masked}@${domain}`;
}

export const useAuth = () => useContext(AuthContext);
