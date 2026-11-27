import { Db, Repository, Row } from '@hr/common';
import type { PoolConnection } from 'mysql2/promise';

export class UserRepository extends Repository {
  constructor(db: Db) { super(db, 'user_accounts', { searchable: ['username', 'email'], sortable: ['username', 'email', 'created_at', 'last_login_at', 'status'] }); }

  findByLogin(login: string): Promise<Row | null> {
    return this.db.one('SELECT * FROM user_accounts WHERE username = ? OR email = ? LIMIT 1', [login, login]);
  }

  async rolesAndPermissions(userId: string): Promise<{ roles: string[]; permissions: string[] }> {
    const roles = await this.db.query<Row>(
      'SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?', [userId]);
    const perms = await this.db.query<Row>(
      `SELECT DISTINCT p.code FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = ?`, [userId]);
    return { roles: roles.map((r) => r.name), permissions: perms.map((p) => p.code) };
  }

  async setRoles(userId: string, roleNames: string[], conn: PoolConnection): Promise<void> {
    const roles = await this.db.query<Row>(`SELECT id, name FROM roles WHERE name IN (${roleNames.map(() => '?').join(',')})`, roleNames, conn);
    if (roles.length !== new Set(roleNames).size) throw new Error('UNKNOWN_ROLE');
    await this.db.exec('DELETE FROM user_roles WHERE user_id = ?', [userId], conn);
    for (const r of roles) await this.db.exec('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)', [userId, r.id], conn);
  }
}

export class RoleRepository extends Repository {
  constructor(db: Db) { super(db, 'roles'); }
  listWithPermissions(): Promise<Row[]> {
    return this.db.query(
      `SELECT r.id, r.name, r.description, COALESCE(GROUP_CONCAT(p.code ORDER BY p.code), '') AS permissions
         FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id LEFT JOIN permissions p ON p.id = rp.permission_id
        GROUP BY r.id, r.name, r.description ORDER BY r.name`);
  }
  async replacePermissions(roleId: string, codes: string[], conn: PoolConnection): Promise<void> {
    const perms = codes.length
      ? await this.db.query<Row>(`SELECT id FROM permissions WHERE code IN (${codes.map(() => '?').join(',')})`, codes, conn) : [];
    if (perms.length !== new Set(codes).size) throw new Error('UNKNOWN_PERMISSION');
    await this.db.exec('DELETE FROM role_permissions WHERE role_id = ?', [roleId], conn);
    for (const p of perms) await this.db.exec('INSERT INTO role_permissions (role_id, permission_id) VALUES (?,?)', [roleId, p.id], conn);
  }
}

export class PermissionRepository extends Repository {
  constructor(db: Db) { super(db, 'permissions'); }
}

export class RefreshTokenRepository extends Repository {
  constructor(db: Db) { super(db, 'refresh_tokens'); }
  findActiveByHash(hash: string): Promise<Row | null> {
    return this.db.one('SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ? LIMIT 1', [hash, new Date()]);
  }
  revokeAllForUser(userId: string): Promise<unknown> {
    return this.db.exec('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [new Date(), userId]);
  }
}

export class ResetTokenRepository extends Repository {
  constructor(db: Db) { super(db, 'password_reset_tokens'); }
  findValid(hash: string): Promise<Row | null> {
    return this.db.one('SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? LIMIT 1', [hash, new Date()]);
  }
}
