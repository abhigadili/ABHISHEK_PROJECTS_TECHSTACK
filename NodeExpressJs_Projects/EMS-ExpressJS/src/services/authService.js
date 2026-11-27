const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const authConfig = require('../config/auth');
const env = require('../config/env');
const { withTransaction } = require('../config/database');
const userRepo = require('../repositories/userRepository');
const tokenRepo = require('../repositories/authTokenRepository');
const employeeRepo = require('../repositories/employeeRepository');
const pw = require('../utils/password');
const ApiError = require('../utils/ApiError');
const { toSqlUtc } = require('../utils/dates');
const mailer = require('../utils/mailer');

// Compared against when the email is unknown so response time does not reveal account existence.
const DUMMY_HASH = require('bcrypt').hashSync('not-a-real-password', authConfig.bcryptRounds);

const invalid = () => ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
const inDays = (d) => toSqlUtc(new Date(Date.now() + d * 86400000));
const inMinutes = (m) => toSqlUtc(new Date(Date.now() + m * 60000));

function signAccess(user) {
  // Payload carries only identifiers + role; no PII or secrets.
  return jwt.sign({ sub: user.id, role: user.role }, authConfig.accessSecret(), { algorithm: 'HS256', expiresIn: authConfig.accessTtl });
}

async function issueTokens(user, familyId, conn) {
  const refreshToken = pw.randomToken();
  const id = await tokenRepo.insertRefresh({
    userId: user.id, tokenHash: pw.sha256(refreshToken), familyId: familyId || crypto.randomUUID(),
    expiresAt: inDays(authConfig.refreshTtlDays),
  }, conn);
  return { id, accessToken: signAccess(user), refreshToken, tokenType: 'Bearer', expiresIn: authConfig.accessTtl };
}
const publicTokens = ({ id, ...t }) => t;

async function login({ email, username }, password) {
  const user = email ? await userRepo.findByEmail(email.toLowerCase()) : await userRepo.findByUsername(username.toLowerCase());
  const ok = await pw.verify(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok || !user.is_active) throw invalid();
  await userRepo.touchLogin(user.id);
  const tokens = await issueTokens(user);
  return { ...publicTokens(tokens), user: { id: user.id, username: user.username || null, email: user.email, role: user.role, employeeId: user.employee_id } };
}

async function refresh(refreshToken) {
  const hash = pw.sha256(refreshToken);
  return withTransaction(async (conn) => {
    const row = await tokenRepo.findRefreshByHash(hash, conn);
    if (!row) throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    if (row.revoked_at) {
      // A rotated token being replayed means it may be stolen: kill the whole family.
      await tokenRepo.revokeFamily(row.family_id, conn);
      await conn.commit(); await conn.beginTransaction();
      throw ApiError.unauthorized('Refresh token has been revoked', 'REFRESH_TOKEN_REUSED');
    }
    if (new Date(`${row.expires_at.replace(' ', 'T')}Z`) < new Date()) throw ApiError.unauthorized('Refresh token expired', 'REFRESH_TOKEN_EXPIRED');
    const user = await userRepo.findById(row.user_id);
    if (!user || !user.is_active) throw ApiError.unauthorized('Account is disabled', 'ACCOUNT_DISABLED');
    const next = await issueTokens(user, row.family_id, conn);
    if (!(await tokenRepo.revokeRefresh(row.id, next.id, conn))) throw ApiError.unauthorized('Refresh token already used', 'REFRESH_TOKEN_REUSED');
    return publicTokens(next);
  });
}

async function logout(refreshToken) {
  const row = await tokenRepo.findRefreshByHash(pw.sha256(refreshToken));
  if (row) await tokenRepo.revokeFamily(row.family_id);
}
const logoutAll = (userId) => tokenRepo.revokeAllForUser(userId);

async function me(user) {
  const account = await userRepo.findById(user.id);
  const employee = account.employee_id ? await employeeRepo.findBrief(account.employee_id) : null;
  return { id: account.id, username: account.username || null, email: account.email, role: account.role, lastLoginAt: account.last_login_at, employee };
}

async function forgotPassword(email) {
  const user = await userRepo.findByEmail(email.toLowerCase());
  const result = { message: 'If the account exists, password reset instructions have been issued' };
  if (!user || !user.is_active) return result;
  const token = pw.randomToken();
  await withTransaction(async (conn) => {
    await tokenRepo.invalidateResets(user.id, conn);
    await tokenRepo.insertReset({ userId: user.id, tokenHash: pw.sha256(token), expiresAt: inMinutes(authConfig.passwordResetTtlMinutes) }, conn);
  });
  await mailer.sendMail({ to: user.email, subject: 'Password reset' });
  if (env.exposeResetToken) result.resetToken = token; // development/test convenience only
  return result;
}

async function resetPassword(token, newPassword) {
  await withTransaction(async (conn) => {
    const row = await tokenRepo.claimReset(pw.sha256(token), conn);
    if (!row) throw ApiError.badRequest('Reset token is invalid, expired or already used', undefined, 'INVALID_RESET_TOKEN');
    await userRepo.updatePassword(row.user_id, await pw.hash(newPassword), conn);
    await tokenRepo.revokeAllForUser(row.user_id, conn);
    await tokenRepo.invalidateResets(row.user_id, conn);
  });
}

async function changePassword(user, currentPassword, newPassword) {
  const account = await userRepo.findById(user.id);
  if (!(await pw.verify(currentPassword, account.password_hash))) throw ApiError.badRequest('Current password is incorrect', undefined, 'WRONG_PASSWORD');
  if (currentPassword === newPassword) throw ApiError.badRequest('New password must differ from the current password', undefined, 'PASSWORD_REUSE');
  await withTransaction(async (conn) => {
    await userRepo.updatePassword(user.id, await pw.hash(newPassword), conn);
    await tokenRepo.revokeAllForUser(user.id, conn); // log out every session
  });
}

module.exports = { login, refresh, logout, logoutAll, me, forgotPassword, resetPassword, changePassword };
