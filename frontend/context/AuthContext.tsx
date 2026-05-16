import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import type { UserDto } from '@/types';
import { usePushNotifications } from '@/lib/usePushNotifications';

interface AuthContextType {
  user: UserDto | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { registerToken } = usePushNotifications();

  useEffect(() => {
    (async () => {
      try {
        const savedToken = await storage.getToken();
        const savedUser = await storage.getUser();
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(savedUser);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    await storage.setToken(res.token);
    const userObj: UserDto = { id: res.userId, email: res.email, name: res.name };
    await storage.setUser(userObj);
    setToken(res.token);
    setUser(userObj);
    registerToken();
  };

  const register = async (email: string, name: string, password: string) => {
    const res = await api.auth.register(email, name, password);
    await storage.setToken(res.token);
    const userObj: UserDto = { id: res.userId, email: res.email, name: res.name };
    await storage.setUser(userObj);
    setToken(res.token);
    setUser(userObj);
    registerToken();
  };

  const logout = async () => {
    await storage.clear();
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const fresh = await api.users.me();
    await storage.setUser(fresh);
    setUser(fresh);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
