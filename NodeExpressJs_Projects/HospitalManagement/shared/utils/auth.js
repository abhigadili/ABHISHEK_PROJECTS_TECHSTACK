import passport from 'passport';
import { Strategy as CustomStrategy } from 'passport-custom';
import { jwtVerify } from 'jose';
import { UnauthorizedError, ForbiddenError } from './errors.js';
import { context } from '../logging/index.js';

let verifyKey; let verifyOpts;

/** Verifies an access token (HS256; signature, issuer, audience, expiry). Shared by Passport (HTTP) and the gRPC server interceptor. */
export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, verifyKey, verifyOpts);
  return { id: Number(payload.sub), username: payload.preferred_username, email: payload.email, roles: payload.roles ?? [], token };
}

export const bearer = (header) => (header && /^Bearer /i.test(header) ? header.slice(7).trim() : null);

/** Registers the Passport "jwt" strategy (passport-custom + jose) and returns the middleware to mount with app.use(). */
export function configureAuth({ secret, issuer, audience }) {
  verifyKey = new TextEncoder().encode(secret);
  verifyOpts = { issuer, audience, algorithms: ['HS256'], clockTolerance: 30 };
  passport.use('jwt', new CustomStrategy(async (req, done) => {
    const token = bearer(req.headers.authorization);
    if (!token) return done(null, false);
    try { return done(null, await verifyAccessToken(token)); } catch { return done(null, false); }
  }));
  return passport.initialize();
}

export const authenticate = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err || !user) return next(new UnauthorizedError());
    req.user = user;
    const store = context.getStore();
    if (store) store.authorization = `Bearer ${user.token}`;      // forwarded on HTTP/gRPC calls to other services
    return next();
  })(req, res, next);
};

export const hasRole = (user, role) => Boolean(user?.roles?.includes(role));
export const isAdmin = (user) => hasRole(user, 'ADMIN');

export const requireRoles = (...roles) => (req, res, next) =>
  (roles.length === 0 || roles.some((r) => hasRole(req.user, r)) ? next() : next(new ForbiddenError()));
