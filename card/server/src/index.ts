// ============================================================
// server/src/index.ts — Salinda Game Server Entry Point
// Express + Socket.io
// ============================================================

import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types';
import { registerSocketHandlers } from './socketHandlers';
import { authMiddleware } from './authMiddleware';
import { cleanupStaleRooms } from './roomManager';
import { cleanupStaleClassSessions } from './classroomManager';
import {
  installHttpDiagnostics,
  installProcessDiagnostics,
  serverBootId,
  serverStartedAt,
  writeServerDiagnostic,
} from './diagnostics';

const PORT = parseInt(process.env.PORT || '3001', 10);
installProcessDiagnostics();

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
  res.json({
    status: 'ok',
    game: 'salinda',
    timestamp: Date.now(),
    bootId: serverBootId,
    startedAt: serverStartedAt.toISOString(),
    uptimeMs: Math.round(process.uptime() * 1000),
  });
});

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  writeServerDiagnostic('error', 'SERVER_HTTP_UNHANDLED_ERROR', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
  }, err);

  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(500).json({
    error: 'internal_server_error',
    bootId: serverBootId,
  });
});

const server = http.createServer(app);
installHttpDiagnostics(server);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: ALLOWED_ORIGINS ? corsOriginCheck as any : '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

io.use(authMiddleware);

io.engine.on('connection_error', (err) => {
  writeServerDiagnostic('warn', 'SOCKET_CONNECTION_ERROR', {
    code: err.code,
    message: err.message,
    context: err.context,
  }, err);
});

io.on('connection', (socket) => {
  console.log(`[CONNECT] ${socket.id}`);
  writeServerDiagnostic('info', 'SOCKET_CONNECTED', {
    socketId: socket.id,
    transport: socket.conn.transport.name,
  });
  socket.on('error', (err) => {
    writeServerDiagnostic('error', 'SOCKET_ERROR', { socketId: socket.id }, err);
  });
  registerSocketHandlers(io, socket);
});

// Cleanup stale rooms every 5 minutes
setInterval(() => {
  cleanupStaleRooms();
  cleanupStaleClassSessions();
}, 5 * 60 * 1000);

// 0.0.0.0 — טלפון/אמולטור ברשת המקומית מתחברים ל־http://<IP-המחשב>:PORT
server.listen(PORT, '0.0.0.0', () => {
  writeServerDiagnostic('info', 'SERVER_STARTED', {
    host: '0.0.0.0',
    port: PORT,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV ?? null,
    corsOrigins: ALLOWED_ORIGINS ?? 'dev-permissive',
  });
  console.log(`🎴 Salinda server listening on 0.0.0.0:${PORT} (LAN: use this PC's IP)`);
});
