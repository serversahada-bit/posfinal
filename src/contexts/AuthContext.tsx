'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { User } from '@/types';
import { AuthState } from '@/types/auth';
import { useRouter } from 'next/navigation';

interface AuthContextType extends AuthState {
  isReady: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_KEY = 'sahada-pos-session';
const AUTH_UPDATED_EVENT = 'sahada-auth-updated';
const emptyAuth: AuthState = { user: null, isAuthenticated: false };

const readStoredUser = (): User | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as User;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
};

const persistSessionUser = (user: User | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!user) {
    localStorage.removeItem(SESSION_KEY);
  } else {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  window.dispatchEvent(new Event(AUTH_UPDATED_EVENT));
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>(() => {
    const storedUser = readStoredUser();
    return storedUser ? { user: storedUser, isAuthenticated: true } : emptyAuth;
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        const json = await response.json() as { success: boolean; data?: User | null };

        if (!isMounted) {
          return;
        }

        if (json.success && json.data) {
          persistSessionUser(json.data);
          setAuth({ user: json.data, isAuthenticated: true });
        } else {
          persistSessionUser(null);
          setAuth(emptyAuth);
        }
      } catch {
        const storedUser = readStoredUser();
        setAuth(storedUser ? { user: storedUser, isAuthenticated: true } : emptyAuth);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };

    void syncSession();

    const handleStorageSync = () => {
      const storedUser = readStoredUser();
      setAuth(storedUser ? { user: storedUser, isAuthenticated: true } : emptyAuth);
    };

    window.addEventListener('storage', handleStorageSync);
    window.addEventListener(AUTH_UPDATED_EVENT, handleStorageSync);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageSync);
      window.removeEventListener(AUTH_UPDATED_EVENT, handleStorageSync);
    };
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const json = await res.json() as { success: boolean; message?: string; data?: User };

      if (json.success && json.data) {
        persistSessionUser(json.data);
        setAuth({ user: json.data, isAuthenticated: true });
        return { success: true, message: 'Login berhasil' };
      }

      persistSessionUser(null);
      setAuth(emptyAuth);
      return { success: false, message: json.message ?? 'Login gagal' };
    } catch {
      return { success: false, message: 'Tidak dapat terhubung ke server. Pastikan DB aktif.' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      persistSessionUser(null);
      setAuth(emptyAuth);
      router.replace('/login');
    }
  };

  const value = useMemo<AuthContextType>(() => ({
    ...auth,
    isReady,
    login,
    logout,
  }), [auth, isReady]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
