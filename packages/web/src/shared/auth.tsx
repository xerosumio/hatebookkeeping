import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeDto, Permission } from '@hbk/shared';
import { api, failureOf } from './api/client';
import { clearWebToken, getWebToken } from './api/session';

interface AuthState {
  me: MeDto | null;
  loading: boolean;
  /** Set when the server could not be reached, so the page can say so instead of bouncing to sign-in. */
  problem: string | null;
  can: (permission: Permission) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const hasToken = getWebToken() !== null;

  const query = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<MeDto>('/auth/me')).data,
    enabled: hasToken,
    retry: false,
    staleTime: 60_000,
  });

  const me = hasToken ? (query.data ?? null) : null;

  const can = useCallback((permission: Permission) => me?.permissions.includes(permission) ?? false, [me]);

  const signOut = useCallback(async () => {
    try {
      // Ends the session on the server, so the token stops working everywhere.
      await api.post('/auth/logout');
    } catch {
      /* the session is already gone or the server is unreachable; still sign out here */
    }
    clearWebToken();
    queryClient.clear();
    window.location.href = '/login';
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      me,
      loading: hasToken && query.isPending,
      problem: query.isError ? failureOf(query.error).message : null,
      can,
      signOut,
    }),
    [me, hasToken, query.isPending, query.isError, query.error, can, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
