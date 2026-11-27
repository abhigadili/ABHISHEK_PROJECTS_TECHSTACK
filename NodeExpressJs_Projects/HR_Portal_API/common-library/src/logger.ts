import pino from 'pino';
import { requestContext } from './context';

const REDACT = [
  'password', 'passwordHash', 'password_hash', 'token', 'accessToken', 'refreshToken', 'authorization',
  'req.headers.authorization', 'headers.authorization', 'jwt', 'secret',
  'accountNumber', 'account_number', 'bankAccount', 'panNumber', 'pan_number', 'nationalId', 'national_id',
  'ifscCode', 'taxNumber', 'annualCtc', 'annual_ctc', '*.password', '*.accessToken', '*.refreshToken',
  '*.accountNumber', '*.panNumber', '*.authorization',
];

export function createLogger(service: string): pino.Logger {
  return pino({
    name: service,
    level: process.env.LOG_LEVEL ?? 'info',
    redact: { paths: REDACT, censor: '[REDACTED]' },
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin() {
      const ctx = requestContext.get();
      return ctx ? { correlationId: ctx.correlationId, userId: ctx.user?.userId } : {};
    },
  });
}

let root: pino.Logger = createLogger('hr');
export function setServiceLogger(service: string): pino.Logger {
  root = createLogger(service);
  return root;
}
export const logger = new Proxy({} as pino.Logger, {
  get: (_t, prop) => (root as any)[prop]?.bind?.(root) ?? (root as any)[prop],
});
