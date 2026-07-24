import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './api';

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
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
