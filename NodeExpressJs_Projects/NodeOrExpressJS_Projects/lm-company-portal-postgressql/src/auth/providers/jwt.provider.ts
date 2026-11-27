// ============================================================
// WHAT: JWT authentication provider
// WHY:  Encapsulates all JWT-based auth logic in one place.
//       The auth factory selects this provider when AUTH_PROVIDER=jwt.
// When to use JWT: APIs consumed by SPAs, mobile apps, microservices.
// When NOT to use JWT: when you need server-side session control,
//                     instant token revocation without a blocklist.
// Interview Tip: JWT is not a session. It's a signed, self-contained claim.
//               The difference matters for logout and revocation design.
// ============================================================

import { query } from '../../database/connection';
import { signAccessToken, signRefreshToken, verifyRefreshToken, getTokenTTL } from '../../utils/jwt.helper';
import { blocklistToken } from '../../cache/redis.client';
import { ROLE_PERMISSIONS, Role } from '../../constants';
import { UnauthorizedError, ConflictError, NotFoundError } from '../../exceptions';
import { OAuthProfile } from '../../types';
import { IUser } from '../../types/entities';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const jwtProvider = {

  async register(data: { firstName: string; lastName: string; email: string; password: string; role?: string }) {
    const existing = await query<IUser>('SELECT id FROM users WHERE email=$1', [data.email.toLowerCase()]);
    if (existing.length > 0) throw new ConflictError('Email already registered');

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const rows = await query<IUser>(`
      INSERT INTO users (first_name, last_name, email, password, role, provider)
      VALUES ($1, $2, $3, $4, $5, 'local') RETURNING id, email, role
    `, [data.firstName, data.lastName, data.email.toLowerCase(), hashedPassword, data.role ?? 'Employee']);

    return { userId: rows[0].id, email: rows[0].email, role: rows[0].role };
  },

  async login(email: string, password: string) {
    const rows = await query<IUser>(
      'SELECT * FROM users WHERE email=$1 AND is_active=TRUE', [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user || !user.password) throw new UnauthorizedError('Invalid email or password');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    const permissions = ROLE_PERMISSIONS[user.role as Role] ?? [];
    const accessToken  = signAccessToken({ userId: user.id, email: user.email, role: user.role as Role, permissions });
    const refreshToken = signRefreshToken(user.id);

    return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } };
  },

  async refreshTokens(token: string) {
    const { userId } = verifyRefreshToken(token);
    const rows = await query<IUser>('SELECT * FROM users WHERE id=$1 AND is_active=TRUE', [userId]);
    if (!rows[0]) throw new UnauthorizedError('User not found or inactive');

    const user = rows[0];
    const permissions = ROLE_PERMISSIONS[user.role as Role] ?? [];
    const accessToken  = signAccessToken({ userId: user.id, email: user.email, role: user.role as Role, permissions });
    const refreshToken = signRefreshToken(user.id);
    return { accessToken, refreshToken };
  },

  async logout(accessToken: string) {
    const ttl = getTokenTTL(accessToken);
    if (ttl > 0) await blocklistToken(accessToken, ttl);
  },

  async forgotPassword(email: string) {
    const rows = await query<IUser>('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
    if (!rows[0]) return;

    const token  = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await query(
      `UPDATE users SET password_reset_token=$1, password_reset_expires=$2 WHERE id=$3`,
      [hashed, expires, rows[0].id]
    );
    return token;
  },

  async resetPassword(token: string, newPassword: string) {
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const rows = await query<IUser>(`
      SELECT id FROM users
      WHERE password_reset_token=$1 AND password_reset_expires > NOW()
    `, [hashed]);
    if (!rows[0]) throw new UnauthorizedError('Token is invalid or has expired');

    const hashedPwd = await bcrypt.hash(newPassword, 12);
    await query(`
      UPDATE users SET password=$1, password_reset_token=NULL, password_reset_expires=NULL, updated_at=NOW()
      WHERE id=$2
    `, [hashedPwd, rows[0].id]);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const rows = await query<IUser>('SELECT id, password FROM users WHERE id=$1', [userId]);
    if (!rows[0]) throw new NotFoundError('User');

    const valid = await bcrypt.compare(currentPassword, rows[0].password ?? '');
    if (!valid) throw new UnauthorizedError('Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password=$1, updated_at=NOW() WHERE id=$2', [hashed, userId]);
  },

  async upsertOAuthUser(profile: OAuthProfile) {
    let rows = await query<IUser>('SELECT * FROM users WHERE email=$1', [profile.email.toLowerCase()]);
    let user = rows[0];

    if (!user) {
      const inserted = await query<IUser>(`
        INSERT INTO users (first_name, last_name, email, provider, provider_id, avatar)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [profile.firstName, profile.lastName, profile.email.toLowerCase(),
          profile.provider, profile.providerId, profile.avatar ?? null]);
      user = inserted[0];
    }

    const permissions = ROLE_PERMISSIONS[user.role as Role] ?? [];
    const accessToken  = signAccessToken({ userId: user.id, email: user.email, role: user.role as Role, permissions });
    const refreshToken = signRefreshToken(user.id);
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } };
  },
};
