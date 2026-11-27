import type { RequestHandler } from 'express';
import { ForbiddenError, NotFoundError, UnauthorizedError, asyncHandler, authenticate, hasPermission, rateLimiter } from '@hr/common';
import { ROUTES, RouteRule, gatewayConfig } from '../config';

const ruleFor = (path: string): RouteRule | undefined => ROUTES.find((r) => path === `/api/v1/${r.prefix}` || path.startsWith(`/api/v1/${r.prefix}/`));

/** Never trust client-supplied internal credentials. */
export const stripInternalHeaders: RequestHandler = (req, _res, next) => { delete req.headers['x-internal-token']; delete req.headers['x-forwarded-user']; next(); };

/** Resolves the route rule, authenticates (unless public) and applies the gateway authorization rules. */
export const gatewaySecurity: RequestHandler = (req, res, next) => {
  const path = req.path;
  if (!path.startsWith('/api/v1/')) return next();
  const rule = ruleFor(path);
  if (!rule && !path.startsWith('/api/v1/dashboard')) return next(new NotFoundError(`Route ${req.method} ${path}`));
  const isPublic = rule?.publicPaths?.some((p) => p.test(path)) ?? false;
  const limit = rateLimiter(isPublic ? 60 : gatewayConfig.rateLimitPerMinute);
  if (isPublic) return limit(req, res, next);
  authenticate()(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (!req.user) return next(new UnauthorizedError());
    if (rule?.anyPermission && !hasPermission(req.user, ...rule.anyPermission)) return next(new ForbiddenError(`Requires one of: ${rule.anyPermission.join(', ')}`));
    limit(req, res, next);
  });
};
void asyncHandler;
