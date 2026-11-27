import express, { Application, ErrorRequestHandler, NextFunction, Request, RequestHandler, Response, Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { ZodError, ZodTypeAny } from 'zod';
import { config } from './config';
import { requestContext } from './context';
import { AppError, ForbiddenError, NotFoundError, TooManyRequestsError, UnauthorizedError, ValidationError } from './errors';
import { verifyAccessToken } from './jwt';
import { logger, setServiceLogger } from './logger';
import { claimIdempotencyKey, rateLimit, tokenBlacklist } from './redis';
import { AuthUser, Role, hasPermission, hasRole } from './types';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    correlationId: string;
    valid: { body?: any; query?: any; params?: any };
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res, next).catch(next); };

// ------------------------------------------------------------------ response helpers
export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data, correlationId: res.req.correlationId, timestamp: new Date().toISOString() });
}
export const created = <T>(res: Response, data: T): void => ok(res, data, 201);
export const noContent = (res: Response): void => { res.status(204).end(); };

// ------------------------------------------------------------------ middleware
export const SENSITIVE_KEYS = new Set(['passwordHash', 'password_hash', 'tokenHash', 'token_hash', 'storagePath', 'storage_path']);

export function correlationId(): RequestHandler {
  return (req, res, next) => {
    const id = (req.header('x-correlation-id') || '').slice(0, 64) || randomUUID();
    req.correlationId = id;
    res.setHeader('x-correlation-id', id);
    requestContext.run({ correlationId: id, authorization: req.header('authorization') }, () => next());
  };
}

export function requestLogger(): RequestHandler {
  return (req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      logger.info({ method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms: Date.now() - started }, 'request');
    });
    next();
  };
}

export function securityHeaders(): RequestHandler[] {
  return [helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }), cors({
    origin: config.corsOrigins, credentials: true, exposedHeaders: ['x-correlation-id', 'content-disposition'],
  })];
}

/** JWT authentication. Accepts the shared internal token for system-to-system calls (stripped by the gateway). */
export function authenticate(): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const header = req.header('authorization');
    if (header?.startsWith('Bearer ')) {
      const user = verifyAccessToken(header.slice(7));
      if (user.tokenId && (await tokenBlacklist.isRevoked(user.tokenId))) throw new UnauthorizedError('Token has been revoked');
      const revokedAt = await tokenBlacklist.userRevokedAt(user.userId);
      if (revokedAt && user.issuedAt && user.issuedAt < Math.floor(revokedAt / 1000)) throw new UnauthorizedError('Session has been invalidated');
      req.user = user;
    } else if (req.header('x-internal-token') && req.header('x-internal-token') === config.internalToken) {
      req.user = { userId: 'system', username: 'system', employeeId: null, roles: [Role.SUPER_ADMIN], permissions: [], system: true };
    } else {
      throw new UnauthorizedError();
    }
    requestContext.setUser(req.user);
    next();
  });
}

export const requireRoles = (...roles: string[]): RequestHandler => (req, _res, next) => {
  if (!req.user) return next(new UnauthorizedError());
  return hasRole(req.user, ...roles) ? next() : next(new ForbiddenError(`Requires one of roles: ${roles.join(', ')}`));
};

export const requirePermission = (...perms: string[]): RequestHandler => (req, _res, next) => {
  if (!req.user) return next(new UnauthorizedError());
  return hasPermission(req.user, ...perms) ? next() : next(new ForbiddenError(`Requires permission: ${perms.join(' or ')}`));
};

/** Allow when the caller holds a role/permission OR the path param refers to their own employee id. */
export const selfOr = (param: string, ...perms: string[]): RequestHandler => (req, _res, next) => {
  if (!req.user) return next(new UnauthorizedError());
  if (req.user.employeeId && req.params[param] === req.user.employeeId) return next();
  return hasPermission(req.user, ...perms) ? next() : next(new ForbiddenError('You may only access your own records'));
};

export function validate(schemas: { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny }): RequestHandler {
  return (req, _res, next) => {
    try {
      req.valid = {};
      if (schemas.params) req.valid.params = schemas.params.parse(req.params);
      if (schemas.query) req.valid.query = schemas.query.parse(req.query);
      if (schemas.body) req.valid.body = schemas.body.parse(req.body);
      next();
    } catch (e) {
      next(e);
    }
  };
}

export function rateLimiter(limitPerMinute: number): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    const id = req.user?.userId ?? req.ip ?? 'anon';
    const r = await rateLimit(id, limitPerMinute);
    res.setHeader('x-ratelimit-remaining', String(r.remaining));
    if (!r.allowed) throw new TooManyRequestsError();
    next();
  });
}

/** Idempotency-Key support for critical POST operations. */
export function idempotent(scope: string): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const k = req.header('idempotency-key');
    if (k) {
      if (!/^[\w-]{8,100}$/.test(k)) throw new ValidationError('Invalid Idempotency-Key');
      const first = await claimIdempotencyKey(`${scope}:${req.user?.userId ?? 'anon'}`, k);
      if (!first) throw new AppError(409, 'DUPLICATE_REQUEST', 'This request was already processed');
    }
    next();
  });
}

const ALLOWED_UPLOAD = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);

/** File upload middleware (memory storage, size cap, MIME allowlist). */
export function uploadSingle(field = 'file'): RequestHandler {
  const m = multer({
    storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes, files: 1 },
    fileFilter: (_req, file, cb) => (ALLOWED_UPLOAD.has(file.mimetype) ? cb(null, true) : cb(new ValidationError(`File type ${file.mimetype} is not allowed`))),
  }).single(field);
  return (req, res, next) => m(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) return next(new ValidationError(err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message));
    return next(err);
  });
}

export const notFoundHandler: RequestHandler = (req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.path}`));

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500; let code = 'INTERNAL_ERROR'; let message = 'An unexpected error occurred'; let details: unknown;
  if (err instanceof ZodError) {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Request validation failed';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err?.type === 'entity.parse.failed') {
    status = 400; code = 'MALFORMED_JSON'; message = 'Malformed JSON body';
  } else if (err?.type === 'entity.too.large') {
    status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'Request body is too large';
  }
  if (status >= 500) logger.error({ err: err?.stack ?? String(err), path: req.path }, 'unhandled error');
  else logger.warn({ code, status, path: req.path, message }, 'request rejected');
  res.status(status).json({
    success: false, status, error: { code, message, ...(details ? { details } : {}) },
    path: req.originalUrl.split('?')[0], correlationId: req.correlationId, timestamp: new Date().toISOString(),
  });
};

// ------------------------------------------------------------------ app factory
export interface ServiceAppOptions {
  name: string;
  mount: (router: Router) => void;
  /** routes that skip authentication (e.g. login) are registered on `publicRouter` before auth */
  mountPublic?: (router: Router) => void;
  basePath?: string;
}

export function createServiceApp(opts: ServiceAppOptions): Application {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.set('json replacer', (k: string, v: unknown) => (SENSITIVE_KEYS.has(k) ? undefined : v));
  app.use(correlationId());
  app.use(...securityHeaders());
  app.use(requestLogger());
  app.get('/health', (_req, res) => { res.json({ status: 'UP', service: opts.name }); });
  app.use(express.json({ limit: '1mb' }));
  const base = opts.basePath ?? '/api/v1';
  if (opts.mountPublic) { const pub = Router(); opts.mountPublic(pub); app.use(base, pub); }
  const secured = Router();
  secured.use(authenticate());
  opts.mount(secured);
  app.use(base, secured);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export interface BootOptions {
  name: string;
  port: number;
  app: Application;
  onShutdown?: () => Promise<void>;
}

export function listen({ name, port, app, onShutdown }: BootOptions): void {
  const server = app.listen(port, () => logger.info({ port }, `${name} listening`));
  const stop = async (sig: string): Promise<void> => {
    logger.info({ sig }, 'shutting down');
    server.close();
    try { await onShutdown?.(); } finally { process.exit(0); }
  };
  process.on('SIGTERM', () => void stop('SIGTERM'));
  process.on('SIGINT', () => void stop('SIGINT'));
  process.on('unhandledRejection', (e) => logger.error({ err: String(e) }, 'unhandled rejection'));
}

export { setServiceLogger };
export const wrap = asyncHandler;
