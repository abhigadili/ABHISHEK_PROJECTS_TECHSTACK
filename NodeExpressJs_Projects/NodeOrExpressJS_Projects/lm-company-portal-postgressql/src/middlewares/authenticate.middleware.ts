// ============================================================
// WHAT: Authentication middleware — verifies the JWT access token
// WHY:  Every protected route must verify the caller's identity
//       before reaching the controller.
// HOW:  1. Extract Bearer token from Authorization header
//        2. Check blocklist (logout invalidation)
//        3. Verify signature and expiry
//        4. Attach decoded payload to req.user
//        5. Call next() so the request continues to the route handler
// Interview Tip: Middleware is the Express pattern for cross-cutting
//               concerns. It runs between the request and the route handler.
//               Order matters — authenticate BEFORE authorize.
// ============================================================

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { verifyAccessToken } from '../utils/jwt.helper';
import { isTokenBlocklisted } from '../cache/redis.client';
import { UnauthorizedError } from '../exceptions';

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from: Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided. Include "Authorization: Bearer <token>".');
    }

    const token = authHeader.split(' ')[1];

    // Check if token was blocklisted (user logged out)
    // WHY: JWTs are stateless — blocklisting is the only way to invalidate
    //      before their natural expiry.
    const blocked = await isTokenBlocklisted(token);
    if (blocked) throw new UnauthorizedError('Token has been revoked. Please login again.');

    // Verify signature + expiry. Throws UnauthorizedError on failure.
    const payload = verifyAccessToken(token);

    // Attach user context to the request object
    // All downstream middleware and controllers can read req.user
    req.user = payload;
    next();
  } catch (err) {
    next(err); // pass to global error handler
  }
};

// Optional auth — doesn't throw if no token, but populates req.user if present
export const optionalAuthenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = verifyAccessToken(token);
    } catch {
      // Ignore errors — treat as unauthenticated
    }
  }
  next();
};
