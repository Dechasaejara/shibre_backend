import { randomUUID } from 'node:crypto';
import { Logger, type LogLevel } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const LEVELS: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

/** LOG_LEVEL=debug enables everything up to debug; defaults to log (debug in development). */
export function resolveLogLevels(level: string | undefined, nodeEnv: string | undefined): LogLevel[] {
  const fallback: LogLevel = nodeEnv === 'production' ? 'log' : 'debug';
  const wanted = (LEVELS as string[]).includes(level ?? '') ? (level as LogLevel) : fallback;
  return LEVELS.slice(0, LEVELS.indexOf(wanted) + 1);
}

/** Keeps the country code and last 3 digits: +251*****041. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '-';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return `${phone.startsWith('+') ? '+' : ''}${digits.slice(0, 3)}${'*'.repeat(digits.length - 6)}${digits.slice(-3)}`;
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : '-';
}

type LoggedRequest = Request & { requestId?: string; user?: { userId?: string; role?: string } };

const httpLogger = new Logger('HTTP');
const QUIET_PATHS = [/\/health$/, /\/api\/docs/];

/** One line per request: method, path (no query string), status, duration, user and request id. */
export function requestLoggingMiddleware(req: LoggedRequest, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const requestId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID().slice(0, 12);
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  const started = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    const path = req.originalUrl.split('?')[0];
    const user = req.user?.userId ? ` user=${shortId(req.user.userId)}` : '';
    const line = `${req.method} ${path} ${res.statusCode} ${durationMs.toFixed(0)}ms${user} req=${requestId}`;
    if (res.statusCode >= 500) httpLogger.error(line);
    else if (res.statusCode >= 400) httpLogger.warn(line);
    else if (QUIET_PATHS.some((pattern) => pattern.test(path))) httpLogger.verbose(line);
    else httpLogger.log(line);
  });

  next();
}
