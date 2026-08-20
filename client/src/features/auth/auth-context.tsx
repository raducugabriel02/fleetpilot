import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { tripNotificationEventSchema, vehicleAlertEventSchema } from '@fleetpilot/shared';
import type { AuthUser, LoginInput, RegisterInput } from '@fleetpilot/shared';
import type { AuthResponse } from '@fleetpilot/shared';
import { apiFetch, refreshSession, setAccessToken, setOnSessionExpired } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';

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

  // socket-ul urmează starea sesiunii: conectat doar cât timp userul e autentificat
  useEffect(() => {
    if (state.status === 'authenticated') {
      connectSocket();
    } else {
      disconnectSocket();
    }
  }, [state.status]);

  // notificări globale (cursă finalizată/întârziată) — vizibile indiferent de pagina
  // curentă, spre deosebire de poziția live, care e specifică dialogului unei curse
  useEffect(() => {
    if (state.status !== 'authenticated') return;
    const socket = connectSocket();

    function onNotification(raw: unknown) {
      const parsed = tripNotificationEventSchema.safeParse(raw);
      if (!parsed.success) return;
      if (parsed.data.kind === 'LATE') {
        toast.warning(parsed.data.message);
      } else {
        toast.success(parsed.data.message);
      }
    }

    socket.on('trip:notification', onNotification);
    return () => {
      socket.off('trip:notification', onNotification);
    };
  }, [state.status]);

  // rezumat zilnic al documentelor de vehicul (ITP/RCA/rovinietă) — vezi vehicle-alert-checker
  useEffect(() => {
    if (state.status !== 'authenticated') return;
    const socket = connectSocket();

    function onVehicleAlert(raw: unknown) {
      const parsed = vehicleAlertEventSchema.safeParse(raw);
      if (!parsed.success) return;
      if (parsed.data.expiredCount > 0) {
        toast.error(parsed.data.message);
      } else {
        toast.warning(parsed.data.message);
      }
    }

    socket.on('vehicle:alert', onVehicleAlert);
    return () => {
      socket.off('vehicle:alert', onVehicleAlert);
    };
  }, [state.status]);

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
