// ============================================================
// server/src/index.ts — Lolos Game Server Entry Point
// Express + Socket.io
// ============================================================

import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types';
import { registerSocketHandlers } from './socketHandlers';
import { cleanupStaleRooms } from './roomManager';
import { cleanupStaleClassSessions } from './classroomManager';

const PORT = parseInt(process.env.PORT || '3001', 10);

// Production: set CORS_ORIGINS env (comma-separated list) to lock the server
// down to known web origins. Dev (no env var) keeps the open policy that
// origin/main shipped with — required so Expo Go on a phone (Android RN may
// send Origin: null with the polling transport) and LAN web clients work.
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : null;

const corsOriginCheck = ALLOWED_ORIGINS
  ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Native mobile clients (Expo Go, standalone APK/IPA) send no Origin,
      // the string "null", "file://" (Android bundle), or other non-https
      // schemes. Only treat something as a browser origin if it starts with
      // https:// or http://, and even then only block it if it's not in the
      // allowlist. This lets all native app connections through while still
      // restricting browser-based web origins.
      const isBrowserOrigin = !!origin && origin !== 'null' && origin.startsWith('http');
      if (!isBrowserOrigin || ALLOWED_ORIGINS.includes(origin!)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Rejected origin: ${origin}`);
        callback(new Error('CORS not allowed'));
      }
    }
  : true; // permissive — dev mode

const app = express();
app.use(cors({ origin: corsOriginCheck as any }));
app.use(express.json());

// Health check
app.get('/', (_req, res) => {
  res.json({ status: 'ok', game: 'lolos', timestamp: Date.now() });
});

const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: ALLOWED_ORIGINS ? corsOriginCheck as any : '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

io.on('connection', (socket) => {
  console.log(`[CONNECT] ${socket.id}`);
  registerSocketHandlers(io, socket);
});

// Cleanup stale rooms every 5 minutes
setInterval(() => {
  cleanupStaleRooms();
  cleanupStaleClassSessions();
}, 5 * 60 * 1000);

// 0.0.0.0 — טלפון/אמולטור ברשת המקומית מתחברים ל־http://<IP-המחשב>:PORT
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎴 Lolos server listening on 0.0.0.0:${PORT} (LAN: use this PC's IP)`);
});
