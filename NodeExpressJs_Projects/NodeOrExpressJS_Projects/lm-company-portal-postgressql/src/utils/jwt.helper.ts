// ============================================================
// WHAT: JWT utility — sign, verify, decode tokens
// WHY:  JSON Web Tokens allow stateless authentication.
//       The server doesn't need to store sessions; the token
//       itself carries the user identity and is cryptographically signed.
// HOW:  Access token (short-lived, 15m) is sent with every API request.
//       Refresh token (long-lived, 7d) is used ONLY to get a new access token.
//       Both are signed with different secrets so a compromised refresh
//       secret doesn't automatically compromise access tokens.
// Bearer Token: client sends "Authorization: Bearer <access_token>"
// Interview Tip: JWT header.payload is base64, NOT encrypted.
//               Don't put sensitive data in the payload.
// When to use JWT: stateless APIs, microservices, mobile apps.
// When NOT to use: when you need instant revocation (use sessions instead).
// ============================================================

import jwt from 'jsonwebtoken';
import { config } from '../config/env.config';
import { JwtPayload } from '../types';
import { UnauthorizedError } from '../exceptions';

// Sign an access token (short-lived)
export const signAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as any,
    algorithm: 'HS256',
  });
};

// Sign a refresh token (long-lived, stored in DB)
export const signRefreshToken = (userId: string): string => {
  return jwt.sign({ userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as any,
  });
};

// Verify and decode an access token — throws if invalid or expired
export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token expired. Please refresh.');
    }
    throw new UnauthorizedError('Invalid access token.');
  }
};

// Verify refresh token
export const verifyRefreshToken = (token: string): { userId: string } => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as { userId: string };
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token. Please login again.');
  }
};

// Decode without verification (useful for reading expiry without throwing)
export const decodeToken = (token: string): JwtPayload | null => {
  return jwt.decode(token) as JwtPayload | null;
};

// Calculate remaining TTL in seconds (for Redis blocklist)
export const getTokenTTL = (token: string): number => {
  const decoded = decodeToken(token);
  if (!decoded?.exp) return 0;
  return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
};
