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

import { User } from '../../models/user.model';
import { signAccessToken, signRefreshToken, verifyRefreshToken, getTokenTTL } from '../../utils/jwt.helper';
import { blocklistToken, cacheDel } from '../../cache/redis.client';
import { ROLE_PERMISSIONS } from '../../constants';
import { UnauthorizedError, ConflictError, NotFoundError } from '../../exceptions';
import { OAuthProfile } from '../../types';
import crypto from 'crypto';

export const jwtProvider = {

  async register(data: { firstName: string; lastName: string; email: string; password: string }) {
    const existing = await User.findOne({ email: data.email });
    if (existing) throw new ConflictError('Email already registered');

    const user = await User.create({ ...data, provider: 'local' });
    return { userId: user.id, email: user.email, role: user.role };
  },

  async login(email: string, password: string) {
    // select('+password') overrides the select:false on the password field
    const user = await User.findOne({ email, isActive: true }).select('+password');
    if (!user || !user.password) throw new UnauthorizedError('Invalid email or password');

    const valid = await user.comparePassword(password);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    const permissions = ROLE_PERMISSIONS[user.role];

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions,
    });
    const refreshToken = signRefreshToken(user.id);

    return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } };
  },

  async refreshTokens(token: string) {
    const { userId } = verifyRefreshToken(token);
    const user = await User.findById(userId);
    if (!user || !user.isActive) throw new UnauthorizedError('User not found or inactive');

    const permissions = ROLE_PERMISSIONS[user.role];
    const accessToken = signAccessToken({ userId: user.id, email: user.email, role: user.role, permissions });
    const refreshToken = signRefreshToken(user.id);

    return { accessToken, refreshToken };
  },

  async logout(accessToken: string) {
    const ttl = getTokenTTL(accessToken);
    if (ttl > 0) await blocklistToken(accessToken, ttl);
  },

  async forgotPassword(email: string) {
    const user = await User.findOne({ email });
    if (!user) return; // Don't reveal if email exists (security)

    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await user.save();

    // In production: send email with reset link containing raw token
    return token; // for demo purposes only
  },

  async resetPassword(token: string, newPassword: string) {
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: new Date() },
    }).select('+password');

    if (!user) throw new UnauthorizedError('Token is invalid or has expired');

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await User.findById(userId).select('+password');
    if (!user) throw new NotFoundError('User');

    const valid = await user.comparePassword(currentPassword);
    if (!valid) throw new UnauthorizedError('Current password is incorrect');

    user.password = newPassword;
    await user.save();
  },

  // Upsert a user from an OAuth profile — also used by oauth.provider.ts
  // after successful OAuth so we always issue our own JWT
  async upsertOAuthUser(profile: OAuthProfile) {
    let user = await User.findOne({ email: profile.email });
    if (!user) {
      user = await User.create({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        provider: profile.provider,
        providerId: profile.providerId,
        avatar: profile.avatar,
      });
    }

    const permissions = ROLE_PERMISSIONS[user.role];
    const accessToken = signAccessToken({ userId: user.id, email: user.email, role: user.role, permissions });
    const refreshToken = signRefreshToken(user.id);

    return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } };
  },
};
