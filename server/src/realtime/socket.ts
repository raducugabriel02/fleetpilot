import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt';
import { env } from '../lib/env';

export interface ServerToClientEvents {
  'vehicle:position': (payload: {
    vehicleId: string;
    tripId: string;
    lat: number;
    lng: number;
    speedKmh: number;
    heading: number | null;
    recordedAt: string;
  }) => void;
  'trip:notification': (payload: {
    tripId: string;
    kind: 'COMPLETED' | 'LATE';
    message: string;
  }) => void;
}

// fără evenimente client→server deocamdată — clientul doar ascultă
type ClientToServerEvents = Record<string, never>;

interface SocketData {
  companyId: string;
}

export type FleetIo = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

let io: FleetIo | null = null;

export function companyRoom(companyId: string): string {
  return `company:${companyId}`;
}

/** singleton — pornit o dată din index.ts, folosit de servicii (ex. simulatorul GPS) pentru emit */
export function getIo(): FleetIo {
  if (!io) {
    throw new Error('Socket.io nu e inițializat — apelează initSocketServer() în index.ts');
  }
  return io;
}

export function initSocketServer(httpServer: HttpServer): FleetIo {
  io = new Server(httpServer, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
  });

  // multi-tenant pe realtime: fiecare socket se alătură DOAR camerei firmei lui,
  // altfel un dispecer ar vedea pozițiile GPS ale altei firme
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const payload = typeof token === 'string' ? verifyAccessToken(token) : null;
    if (!payload) {
      next(new Error('UNAUTHENTICATED'));
      return;
    }
    socket.data.companyId = payload.companyId;
    next();
  });

  io.on('connection', (socket) => {
    void socket.join(companyRoom(socket.data.companyId));
  });

  return io;
}
