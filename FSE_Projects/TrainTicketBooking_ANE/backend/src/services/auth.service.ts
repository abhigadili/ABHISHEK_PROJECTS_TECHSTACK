import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { prisma } from '../database/prisma';
import { env } from '../config/env';
import { tokenRepo, userRepo } from '../repositories/user.repository';
import { badRequest, conflict, tooMany, unauthorized } from '../utils/errors';
import { randomToken, sha256 } from '../utils/crypto';
import { signAccessToken } from '../utils/tokens';
import { toUserDto } from '../utils/serializers';
import { sendMail } from './mail.service';
import { notify } from './notification.service';
import type { RegisterInput } from '../validations/auth';
import type { RoleKey } from '../constants/rbac';

const MAX_FAILS = 5, LOCK_MIN = 15;
const hashRefresh = (raw: string) => sha256(`${raw}.${env.JWT_REFRESH_SECRET}`); // refresh tokens are stored only as peppered SHA-256
const DUMMY = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO5pmM.sdsU1FHYdhlYSY.xXWL9B3g1Le'; // equalises timing for unknown e-mails

async function issue(userId: number, familyId: string, ua?: string) {
  const user = await userRepo.byId(userId); if (!user) throw unauthorized();
  const refresh = randomToken(48);
  await tokenRepo.createRefresh({ userId, tokenHash: hashRefresh(refresh), familyId, expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRY_DAYS * 86_400_000), userAgent: ua?.slice(0, 250) });
  return { user: toUserDto(user), accessToken: signAccessToken(user.id, user.roles.map((r) => r.role.key as RoleKey)), refreshToken: refresh };
}

export const authService = {
  /** Scenario 1: validated input -> bcrypt hash -> user + PASSENGER role + preferences in one transaction. */
  async register(d: RegisterInput) {
    const dup = await userRepo.existsEmailOrMobile(d.email, d.mobile);
    if (dup) throw conflict('An account with this e-mail or mobile number already exists', { [dup.email === d.email ? 'email' : 'mobile']: 'Already registered' });
    const passwordHash = await bcrypt.hash(d.password, 12);
    const user = await prisma.$transaction((tx) => userRepo.create(tx, { name: d.name, email: d.email, mobile: d.mobile, passwordHash }, 'PASSENGER'));
    await notify(user.id, { type: 'WELCOME', title: 'Welcome aboard', message: 'Your account is ready. Search trains and book your first ticket.', link: '/search' });
    return toUserDto(user);
  },
  async login(email: string, password: string, ua?: string) {
    const u = await userRepo.byEmail(email);
    if (u?.lockedUntil && u.lockedUntil > new Date()) throw tooMany('Account temporarily locked after too many failed attempts');
    const okPw = await bcrypt.compare(password, u?.passwordHash ?? DUMMY);
    if (!u || !okPw) { if (u) { const f = u.failedLogins + 1; await userRepo.recordFailure(u.id, f, f >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60_000) : null); } throw unauthorized('Invalid e-mail or password'); }
    if (u.status !== 'ACTIVE') throw unauthorized(u.status === 'SUSPENDED' ? 'This account has been suspended' : 'This account is not active');
    await userRepo.recordLogin(u.id);
    return issue(u.id, randomUUID(), ua);
  },
  /**
   * Refresh-token ROTATION: each refresh token is single use. Presenting an already-rotated token (replay/theft) revokes the entire
   * family. Concurrent refreshes with the same token: the first wins, the loser gets 401 and the client retries with the new cookie.
   */
  async refresh(raw: string, ua?: string) {
    const row = await tokenRepo.findRefresh(hashRefresh(raw));
    if (!row) throw unauthorized('Invalid refresh token');
    if (row.revokedAt) { await tokenRepo.revokeFamily(row.familyId); throw unauthorized('Refresh token reuse detected - please sign in again'); }
    if (row.expiresAt < new Date()) throw unauthorized('Session expired');
    const user = await userRepo.byId(row.userId);
    if (!user || user.status !== 'ACTIVE') { await tokenRepo.revokeAllForUser(row.userId); throw unauthorized('Account is not active'); }
    const claimed = await prisma.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date() } }); // atomic claim
    if (claimed.count !== 1) throw unauthorized('Refresh token already used');
    return issue(row.userId, row.familyId, ua);
  },
  async logout(raw?: string) { if (!raw) return; const row = await tokenRepo.findRefresh(hashRefresh(raw)); if (row) await tokenRepo.revokeFamily(row.familyId); },
  async forgotPassword(email: string) {
    const u = await userRepo.byEmail(email); if (!u || u.status !== 'ACTIVE') return; // identical response either way (no account enumeration)
    const raw = randomToken(32);
    await tokenRepo.createReset({ userId: u.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 3_600_000) });
    await sendMail(u.email, 'Reset your password', `Use this link within one hour to choose a new password:\n${env.FRONTEND_URL}/reset-password?token=${raw}`);
  },
  async resetPassword(token: string, password: string) {
    const row = await tokenRepo.findReset(sha256(token));
    if (!row || row.usedAt || row.expiresAt < new Date()) throw badRequest('This reset link is invalid or has expired');
    await prisma.$transaction([prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await bcrypt.hash(password, 12), failedLogins: 0, lockedUntil: null } }), prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } })]);
    await tokenRepo.revokeAllForUser(row.userId); // every device must sign in again
  },
  async changePassword(userId: number, current: string, next: string, currentRefresh?: string) {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(current, u.passwordHash))) throw badRequest('Current password is incorrect', { currentPassword: 'Incorrect password' });
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(next, 12) } });
    await tokenRepo.revokeAllForUser(userId, currentRefresh ? hashRefresh(currentRefresh) : undefined); // other sessions are signed out
  },
  async me(userId: number) { const u = await userRepo.byId(userId); if (!u) throw unauthorized(); return toUserDto(u); },
};
