import pino from 'pino';
import pinoHttp from 'pino-http';
import pinoRoll from 'pino-roll';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { CORRELATION_HEADER } from '../constants/index.js';

/** Per-request context (correlation id + the caller's Authorization header) carried through async calls, HTTP/gRPC/Kafka. */
export const context = new AsyncLocalStorage();
export const currentContext = () => context.getStore() ?? {};
export const newCorrelationId = () => randomUUID().replaceAll('-', '').slice(0, 16);

const REDACT = ['req.headers.authorization', 'req.headers.cookie', 'password', '*.password', '*.passwordHash', '*.token', '*.accessToken', '*.refreshToken', '*.authorization', 'res.headers["set-cookie"]'];

/**
 * Structured JSON logs: console + rolling file (pino-roll: daily or 20 MB, 7 files kept) through pino.multistream.
 * Levels are written as labels (info / warn / error / fatal). Async because pino-roll opens its file stream asynchronously.
 */
export async function createLogger(service, { level = 'info', dir = 'logs' } = {}) {
  const file = await pinoRoll({ file: path.join(dir, service), frequency: 'daily', size: '20m', mkdir: true, extension: '.log', limit: { count: 7 } });
  const streams = pino.multistream([{ level, stream: pino.destination({ dest: 1, sync: false }) }, { level, stream: file }]);
  const logger = pino({
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT, censor: '[redacted]' },
    mixin: () => ({ correlationId: context.getStore()?.correlationId }),
    formatters: { level: (label) => ({ level: label }) },
  }, streams);
  logger.flush = () => { try { file.flushSync?.(); } catch { /* stream already closed */ } };
  return logger;
}

/** pino-http middleware: correlation id in/out, one log line per request (method, path without query, status, time - never bodies/headers). */
export function httpLogger(logger) {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = String(req.headers[CORRELATION_HEADER] ?? '').slice(0, 64) || newCorrelationId();
      res.setHeader(CORRELATION_HEADER, id);
      return id;
    },
    customLogLevel: (req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    customSuccessMessage: (req, res) => `${req.method} ${req.url.split('?')[0]} -> ${res.statusCode}`,
    customErrorMessage: (req, res) => `${req.method} ${req.url.split('?')[0]} failed -> ${res.statusCode}`,
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url.split('?')[0] }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
    autoLogging: { ignore: (req) => req.url === '/ping' },
  });
}
