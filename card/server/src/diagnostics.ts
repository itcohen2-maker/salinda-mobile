import type http from 'http';
import { randomUUID } from 'crypto';

export type DiagnosticLevel = 'info' | 'warn' | 'error';

export const serverBootId = randomUUID();
export const serverStartedAt = new Date();

let processDiagnosticsInstalled = false;
let fatalExitScheduled = false;

function normalizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: cause instanceof Error
        ? {
            name: cause.name,
            message: cause.message,
            stack: cause.stack,
          }
        : sanitizeDiagnosticValue(cause),
    };
  }

  return {
    type: typeof error,
    value: sanitizeDiagnosticValue(error),
  };
}

function sanitizeDiagnosticValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return String(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (depth >= 3) return '[MaxDepth]';
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeDiagnosticValue(item, depth + 1, seen));
  }

  const output: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).slice(0, 30).forEach(([key, item]) => {
    output[key] = sanitizeDiagnosticValue(item, depth + 1, seen);
  });
  return output;
}

export function writeServerDiagnostic(
  level: DiagnosticLevel,
  event: string,
  details: Record<string, unknown> = {},
  error?: unknown,
) {
  const payload = {
    timestamp: new Date().toISOString(),
    event,
    bootId: serverBootId,
    pid: process.pid,
    uptimeMs: Math.round(process.uptime() * 1000),
    details: sanitizeDiagnosticValue(details),
    ...(error === undefined ? {} : { error: normalizeError(error) }),
  };

  const message = `[${event}] ${JSON.stringify(payload)}`;
  if (level === 'error') {
    console.error(message);
  } else if (level === 'warn') {
    console.warn(message);
  } else {
    console.log(message);
  }
}

export function installProcessDiagnostics() {
  if (processDiagnosticsInstalled) return;
  processDiagnosticsInstalled = true;

  process.on('uncaughtException', (error) => {
    writeServerDiagnostic('error', 'SERVER_UNCAUGHT_EXCEPTION', {}, error);
    scheduleFatalExit();
  });

  process.on('unhandledRejection', (reason) => {
    writeServerDiagnostic('error', 'SERVER_UNHANDLED_REJECTION', {}, reason);
    scheduleFatalExit();
  });

  process.on('warning', (warning) => {
    writeServerDiagnostic('warn', 'SERVER_PROCESS_WARNING', {}, warning);
  });

  process.on('SIGTERM', () => {
    writeServerDiagnostic('warn', 'SERVER_SIGNAL_RECEIVED', { signal: 'SIGTERM' });
  });

  process.on('SIGINT', () => {
    writeServerDiagnostic('warn', 'SERVER_SIGNAL_RECEIVED', { signal: 'SIGINT' });
  });

  process.on('beforeExit', (code) => {
    writeServerDiagnostic('warn', 'SERVER_BEFORE_EXIT', { code });
  });

  process.on('exit', (code) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'SERVER_EXIT',
      bootId: serverBootId,
      pid: process.pid,
      uptimeMs: Math.round(process.uptime() * 1000),
      code,
    }));
  });
}

function scheduleFatalExit() {
  if (fatalExitScheduled) return;
  fatalExitScheduled = true;
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 250).unref();
}

export function installHttpDiagnostics(server: http.Server) {
  server.on('clientError', (error, socket) => {
    const networkSocket = socket as typeof socket & {
      remoteAddress?: string;
      remotePort?: number;
    };
    writeServerDiagnostic('warn', 'SERVER_HTTP_CLIENT_ERROR', {
      remoteAddress: networkSocket.remoteAddress,
      remotePort: networkSocket.remotePort,
    }, error);
  });

  server.on('error', (error) => {
    writeServerDiagnostic('error', 'SERVER_HTTP_ERROR', {}, error);
  });
}
