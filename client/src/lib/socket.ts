import { io, type Socket } from 'socket.io-client';
import { getAccessToken, refreshSession } from './api';

let socket: Socket | null = null;

/**
 * `auth` ca funcție (nu obiect static): socket.io-client o reapelează la fiecare
 * (re)conectare, deci reconectarea după expirarea/reînnoirea access token-ului
 * ia mereu valoarea curentă din memorie, fără cod suplimentar de resincronizare.
 */
export function connectSocket(): Socket {
  if (socket) return socket;
  socket = io({
    autoConnect: true,
    auth: (cb) => cb({ token: getAccessToken() }),
  });
  // token expirat cât conexiunea era jos (rețea instabilă pe o cursă lungă): reînnoim
  // din cookie-ul de refresh, ca reîncercarea automată a socket.io să ia tokenul proaspăt
  // (fără asta, `auth` de mai sus tot tokenul vechi din memorie l-ar retrimite la infinit).
  // Verificăm mesajul (setat explicit de middleware-ul din server/src/realtime/socket.ts)
  // ca să nu declanșăm un refresh la orice deconectare (server jos, rețea căzută complet).
  // Dacă refresh-ul confirmă că sesiunea chiar a murit, api.ts apelează onSessionExpired,
  // care duce la disconnectSocket() din auth-context — oprind reîncercările la infinit.
  socket.on('connect_error', (err) => {
    if (err.message === 'UNAUTHENTICATED') {
      void refreshSession();
    }
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
