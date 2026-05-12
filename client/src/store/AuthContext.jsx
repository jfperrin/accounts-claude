import { createContext, useContext, useEffect, useState } from 'react';
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

  // Si la réponse est { mfaRequired }, on pose le challenge et renvoie cette valeur ;
  // sinon comportement actuel (user complet + setUser).
  const login = async (credentials) => {
    const res = await apiLogin(credentials);
    if (res && res.mfaRequired) {
      setMfaChallenge({ methods: res.methods, email: maskEmail(credentials.email) });
      return res;
    }
    setUser(res);
    return res;
  };

  const register = async (credentials) => apiRegister(credentials);

  const logout = async () => {
    await apiLogout();
    setUser(null);
    setMfaChallenge(null);
  };

  const updateUser = (u) => setUser(u);

  const verifyMfa = async (method, code) => {
    const u = await verifyChallenge(method, code);
    setMfaChallenge(null);
    setUser(u);
    return u;
  };

  const cancelMfa = async () => {
    try { await cancelChallenge(); } catch { /* idempotent */ }
    setMfaChallenge(null);
  };

  const sendMfaEmail = () => sendChallengeEmail();

  return (
    <AuthContext.Provider value={{
      user, mfaChallenge,
      login, register, logout, updateUser,
      verifyMfa, cancelMfa, sendMfaEmail,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  const masked = local.length <= 2 ? local : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${masked}@${domain}`;
}

export const useAuth = () => useContext(AuthContext);
