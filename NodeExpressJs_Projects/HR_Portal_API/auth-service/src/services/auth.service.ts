import crypto from 'node:crypto';
import {
  AppError, Db, ForbiddenError, UnauthorizedError, ValidationError, bcrypt, buildEvent, cache, enqueueOutbox, key, logger,
  redis, requestContext, signAccessToken, tokenBlacklist, Topics, audit, config, toDto, Row, NotFoundError,
} from '@hr/common';
import { authConfig } from '../config';
import { USER_FIELDS } from '../dto/auth.dto';
import { RefreshTokenRepository, ResetTokenRepository, UserRepository } from '../repositories/auth.repository';

const sha256 = (s: string): string => crypto.createHash('sha256').update(s).digest('hex');
// dummy hash so unknown usernames cost the same as wrong passwords (no user enumeration by timing)
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export class AuthService {
  private readonly users: UserRepository;
  private readonly refreshTokens: RefreshTokenRepository;
  private readonly resets: ResetTokenRepository;

  constructor(private readonly db: Db) {
    this.users = new UserRepository(db);
    this.refreshTokens = new RefreshTokenRepository(db);
    this.resets = new ResetTokenRepository(db);
  }

  private async issueTokens(user: Row, ip?: string) {
    const { roles, permissions } = await this.users.rolesAndPermissions(user.id);
    const access = signAccessToken({ userId: user.id, username: user.username, employeeId: user.employee_id, roles, permissions });
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const expires = new Date(Date.now() + config.jwt.refreshTtl * 1000);
    await this.refreshTokens.insert({
      user_id: user.id, token_hash: sha256(refreshToken), access_token_id: access.jti, expires_at: expires, ip_address: ip ?? null,
    });
    await redis().set(key('auth', 'refresh', sha256(refreshToken)), user.id, 'EX', config.jwt.refreshTtl).catch(() => undefined);
    return {
      accessToken: access.token, tokenType: 'Bearer', expiresIn: access.expiresIn, refreshToken,
      mustChangePassword: !!user.must_change_password,
      user: { id: user.id, username: user.username, email: user.email, employeeId: user.employee_id, roles, permissions },
    };
  }

  async login(username: string, password: string, ip?: string) {
    const user = await this.users.findByLogin(username);
    if (!user) { await bcrypt.compare(password, DUMMY_HASH); throw new UnauthorizedError('Invalid username or password'); }
    if (user.status === 'INACTIVE') throw new ForbiddenError('Account is deactivated');
    if (user.locked_until && new Date(user.locked_until) > new Date()) throw new AppError(423, 'ACCOUNT_LOCKED', 'Account is temporarily locked due to repeated failed logins');
    const good = await bcrypt.compare(password, user.password_hash);
    if (!good) {
      const attempts = (user.failed_attempts ?? 0) + 1;
      const lock = attempts >= authConfig.maxFailedAttempts;
      await this.users.update(user.id, {
        failed_attempts: lock ? 0 : attempts, ...(lock ? { locked_until: new Date(Date.now() + authConfig.lockMinutes * 60000) } : {}),
      });
      await redis().incr(key('auth', 'failed', user.id)).then(() => redis().expire(key('auth', 'failed', user.id), 900)).catch(() => undefined);
      logger.warn({ userId: user.id, attempts }, 'failed login');
      if (lock) throw new AppError(423, 'ACCOUNT_LOCKED', `Account locked for ${authConfig.lockMinutes} minutes`);
      throw new UnauthorizedError('Invalid username or password');
    }
    await this.users.update(user.id, { failed_attempts: 0, locked_until: null, last_login_at: new Date(), ...(user.status === 'LOCKED' ? { status: 'ACTIVE' } : {}) });
    return this.issueTokens(user, ip);
  }

  /** Refresh-token rotation: the presented token is revoked and a new pair issued. */
  async refresh(refreshToken: string, ip?: string) {
    const row = await this.refreshTokens.findActiveByHash(sha256(refreshToken));
    if (!row) throw new UnauthorizedError('Invalid refresh token');
    const user = await this.users.findById(row.user_id);
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedError('Account is not active');
    await this.refreshTokens.update(row.id, { revoked_at: new Date() });
    await redis().del(key('auth', 'refresh', sha256(refreshToken))).catch(() => undefined);
    if (row.access_token_id) await tokenBlacklist.revoke(row.access_token_id, config.jwt.accessTtl);
    return this.issueTokens(user, ip);
  }

  async logout(refreshToken?: string): Promise<void> {
    const u = requestContext.user();
    if (u?.tokenId) await tokenBlacklist.revoke(u.tokenId, config.jwt.accessTtl);
    if (refreshToken) {
      const row = await this.refreshTokens.findActiveByHash(sha256(refreshToken));
      if (row && row.user_id === u?.userId) await this.refreshTokens.update(row.id, { revoked_at: new Date() });
      await redis().del(key('auth', 'refresh', sha256(refreshToken))).catch(() => undefined);
    }
  }

  async me(userId: string) {
    const user = await this.users.getById(userId, 'User');
    const { roles, permissions } = await this.users.rolesAndPermissions(userId);
    return { ...toDto(user, USER_FIELDS), roles, permissions };
  }

  async changePassword(userId: string, current: string, next: string): Promise<void> {
    const user = await this.users.getById(userId, 'User');
    if (!(await bcrypt.compare(current, user.password_hash))) throw new ValidationError('Current password is incorrect');
    if (await bcrypt.compare(next, user.password_hash)) throw new ValidationError('New password must differ from the current password');
    await this.setPassword(userId, next, false);
    await this.invalidateSessions(userId);
  }

  private async setPassword(userId: string, password: string, mustChange: boolean): Promise<void> {
    await this.db.tx(async (conn) => {
      await this.users.update(userId, {
        password_hash: await bcrypt.hash(password, 10), password_changed_at: new Date(), must_change_password: mustChange ? 1 : 0, failed_attempts: 0, locked_until: null,
      }, conn);
      await audit(this.db, conn, 'UserAccount', userId, 'PASSWORD_CHANGED');
    });
  }

  async invalidateSessions(userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId);
    await tokenBlacklist.revokeAllForUser(userId, config.jwt.accessTtl + 60);
  }

  /** Always answers the same way; a token (stored only as a hash) is emailed via the notification pipeline. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findOne({ email });
    if (!user || user.status === 'INACTIVE') return;
    const token = crypto.randomBytes(32).toString('base64url');
    await this.db.tx(async (conn) => {
      await this.resets.insert({ user_id: user.id, token_hash: sha256(token), expires_at: new Date(Date.now() + authConfig.resetTokenMinutes * 60000) }, conn);
      await enqueueOutbox(this.db, conn, Topics.NOTIFICATION_REQUESTED, buildEvent(Topics.NOTIFICATION_REQUESTED, 'auth-service', {
        type: 'PASSWORD_RESET', recipientEmail: user.email, recipientEmployeeId: user.employee_id,
        subject: 'Reset your HR Portal password', body: `Use this one-time token within ${authConfig.resetTokenMinutes} minutes: ${token}`, dedupeKey: `pwreset:${user.id}`,
      }, user.employee_id));
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const row = await this.resets.findValid(sha256(token));
    if (!row) throw new ValidationError('Reset token is invalid or has expired');
    await this.setPassword(row.user_id, newPassword, false);
    await this.resets.update(row.id, { used_at: new Date() });
    await this.invalidateSessions(row.user_id);
  }

  /** Called by the employee.terminated consumer. */
  async deactivateByEmployee(employeeId: string, conn?: any): Promise<void> {
    const user = await this.users.findOne({ employee_id: employeeId });
    if (!user) return;
    await this.users.update(user.id, { status: 'INACTIVE' }, conn);
    await audit(this.db, conn, 'UserAccount', user.id, 'DEACTIVATED_ON_EXIT', { status: user.status }, { status: 'INACTIVE' });
    await this.invalidateSessions(user.id);
  }

  async ensureBootstrapAdmin(username?: string, email?: string, password?: string): Promise<void> {
    if (!username || !password) return;
    const existing = await this.users.findByLogin(username);
    if (existing) {
      // the environment is the source of truth for the bootstrap account's password
      if (existing.created_by === 'system' && !(await bcrypt.compare(password, existing.password_hash))) {
        await this.users.update(existing.id, { password_hash: await bcrypt.hash(password, 10), password_changed_at: new Date(), failed_attempts: 0, locked_until: null, status: 'ACTIVE' });
        logger.info({ username }, 'bootstrap admin password re-synced from environment');
      }
      return;
    }
    const role = await this.db.one<Row>("SELECT id FROM roles WHERE name = 'SUPER_ADMIN'");
    if (!role) throw new NotFoundError('Role SUPER_ADMIN');
    await this.db.tx(async (conn) => {
      const u = await this.users.insert({
        username, email: email ?? `${username}@hrportal.local`, password_hash: await bcrypt.hash(password, 10),
        status: 'ACTIVE', failed_attempts: 0, must_change_password: 0, password_changed_at: new Date(),
      }, conn);
      await this.db.exec('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)', [u.id, role.id], conn);
    });
    logger.info({ username }, 'bootstrap super admin created');
  }
}

export { cache };
