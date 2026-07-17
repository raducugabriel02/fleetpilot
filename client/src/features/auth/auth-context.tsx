import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthUser, LoginInput, RegisterInput } from '@fleetpilot/shared';
import type { AuthResponse } from '@fleetpilot/shared';
import { apiFetch, refreshSession, setAccessToken, setOnSessionExpired } from '@/lib/api';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'guest'; user: null }
  | { status: 'authenticated'; user: AuthUser };

// AuthState e union discriminat, deci intersecție, nu extends
type AuthContextValue = AuthState & {
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  // la încărcarea aplicației încercăm să reluăm sesiunea din cookie-ul de refresh
  useEffect(() => {
    let cancelled = false;
    void refreshSession().then((session) => {
      if (cancelled) return;
      setState(
        session ? { status: 'authenticated', user: session.user } : { status: 'guest', user: null },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // dacă un request nu mai poate reînnoi sesiunea, ieșim curat din cont
  useEffect(() => {
    setOnSessionExpired(() => {
      setAccessToken(null);
      setState({ status: 'guest', user: null });
    });
    return () => setOnSessionExpired(null);
  }, []);

  const applyAuth = useCallback((response: AuthResponse) => {
    setAccessToken(response.accessToken);
    setState({ status: 'authenticated', user: response.user });
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      applyAuth(await apiFetch<AuthResponse>('/api/auth/login', { method: 'POST', body: input }));
    },
    [applyAuth],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      applyAuth(
        await apiFetch<AuthResponse>('/api/auth/register', { method: 'POST', body: input }),
      );
    },
    [applyAuth],
  );

  const logout = useCallback(async () => {
    await apiFetch<void>('/api/auth/logout', { method: 'POST' });
    setAccessToken(null);
    setState({ status: 'guest', user: null });
  }, []);

  const value = useMemo(
    () => ({ ...state, login, register, logout }),
    [state, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth se folosește doar în interiorul AuthProvider');
  }
  return ctx;
}
