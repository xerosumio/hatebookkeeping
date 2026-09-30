import { createContext, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { apiUrl } from '../api/base';
import { clearWebToken, getWebToken } from '../api/session';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const token = getWebToken();
  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<User>('/auth/me').then((r) => r.data),
    enabled: !!token,
    retry: false,
  });

  const login = useCallback(() => {
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `${apiUrl('/auth/login')}?returnTo=${returnTo}`;
  }, []);

  const logout = useCallback(() => {
    void api.post('/auth/logout').catch(() => {});
    clearWebToken();
    queryClient.clear();
    window.location.href = '/login';
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        token,
        isAuthenticated: !!token && !!user,
        isLoading: !!token && isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
