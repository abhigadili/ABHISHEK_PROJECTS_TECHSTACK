import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { config } from './config';
import { UnauthorizedError } from './errors';
import type { AuthUser } from './types';

interface Claims {
  sub: string;
  usr: string;
  emp: string | null;
  roles: string[];
  perms: string[];
  jti: string;
  iat?: number;
  typ: 'access';
}

export function signAccessToken(user: Omit<AuthUser, 'tokenId'>): { token: string; jti: string; expiresIn: number } {
  const jti = uuid();
  const claims: Claims = {
    sub: user.userId, usr: user.username, emp: user.employeeId, roles: user.roles, perms: user.permissions, jti, typ: 'access',
  };
  const token = jwt.sign(claims, config.jwt.secret, { algorithm: 'HS256', expiresIn: config.jwt.accessTtl, issuer: 'hr-portal-node' });
  return { token, jti, expiresIn: config.jwt.accessTtl };
}

export function verifyAccessToken(token: string): AuthUser {
  try {
    const c = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'], issuer: 'hr-portal-node' }) as unknown as Claims;
    if (c.typ !== 'access') throw new Error('wrong token type');
    return { userId: c.sub, username: c.usr, employeeId: c.emp, roles: c.roles ?? [], permissions: c.perms ?? [], tokenId: c.jti, issuedAt: c.iat };
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
