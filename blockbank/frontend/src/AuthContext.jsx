import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('blockbank_token'));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('blockbank_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [account, setAccount] = useState(() => {
    const raw = localStorage.getItem('blockbank_account');
    return raw ? JSON.parse(raw) : null;
  });

  const login = useCallback((data) => {
    localStorage.setItem('blockbank_token', data.token);
    localStorage.setItem('blockbank_user', JSON.stringify(data.user));
    localStorage.setItem('blockbank_account', JSON.stringify(data.account));
    setToken(data.token);
    setUser(data.user);
    setAccount(data.account);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('blockbank_token');
    localStorage.removeItem('blockbank_user');
    localStorage.removeItem('blockbank_account');
    setToken(null);
    setUser(null);
    setAccount(null);
  }, []);

  const refreshAccount = useCallback(async () => {
    try {
      const res = await api.get('/account/me');
      setAccount(res.data.account);
      localStorage.setItem('blockbank_account', JSON.stringify(res.data.account));
    } catch (err) {
      // ignore
    }
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, account, login, logout, refreshAccount, setAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
