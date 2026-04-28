import { createContext, useContext, useEffect, useState } from 'react';
import {
  me,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
} from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    me().then(setUser).catch(() => setUser(null));
  }, []);

  const login = async (credentials) => {
    const u = await apiLogin(credentials);
    setUser(u);
    return u;
  };

  // register retourne { message } et n'ouvre pas de session
  const register = async (credentials) => {
    return apiRegister(credentials);
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  const updateUser = (u) => setUser(u);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
