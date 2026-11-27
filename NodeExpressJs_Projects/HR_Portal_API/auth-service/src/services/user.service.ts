import {
  ConflictError, Db, NotFoundError, Page, PageRequest, Row, ValidationError, audit, auditTrail, bcrypt, toDto, toDtoPage, ForbiddenError, requestContext,
} from '@hr/common';
import { USER_FIELDS } from '../dto/auth.dto';
import { PermissionRepository, RoleRepository, UserRepository } from '../repositories/auth.repository';
import type { AuthService } from './auth.service';

export class UserService {
  private readonly users: UserRepository;
  private readonly roles: RoleRepository;
  private readonly permissions: PermissionRepository;
  constructor(private readonly db: Db, private readonly auth: AuthService) {
    this.users = new UserRepository(db); this.roles = new RoleRepository(db); this.permissions = new PermissionRepository(db);
  }

  async list(req: PageRequest, q: string | undefined, status?: string): Promise<Page<Row>> {
    return toDtoPage(await this.users.page(status ? { status } : {}, req, q), USER_FIELDS);
  }

  async get(id: string) {
    const u = await this.users.getById(id, 'User');
    return { ...toDto(u, USER_FIELDS), ...(await this.users.rolesAndPermissions(id)) };
  }

  async create(dto: { username: string; email: string; password: string; employeeId?: string; roles: string[]; mustChangePassword: boolean }) {
    if (await this.users.findOne({ username: dto.username })) throw new ConflictError('Username already exists');
    if (await this.users.findOne({ email: dto.email })) throw new ConflictError('Email already exists');
    if (dto.employeeId && (await this.users.findOne({ employee_id: dto.employeeId }))) throw new ConflictError('Employee already has an account');
    const hash = await bcrypt.hash(dto.password, 10);
    const id = await this.db.tx(async (conn) => {
      const u = await this.users.insert({
        username: dto.username, email: dto.email, password_hash: hash, employee_id: dto.employeeId ?? null, status: 'ACTIVE',
        failed_attempts: 0, must_change_password: dto.mustChangePassword ? 1 : 0, password_changed_at: new Date(),
      }, conn);
      await this.setRolesChecked(u.id, dto.roles, conn);
      await audit(this.db, conn, 'UserAccount', u.id, 'CREATED', undefined, { username: dto.username, roles: dto.roles });
      return u.id as string;
    });
    return this.get(id);
  }

  private async setRolesChecked(userId: string, roles: string[], conn: any): Promise<void> {
    try { await this.users.setRoles(userId, roles, conn); } catch (e: any) {
      if (e.message === 'UNKNOWN_ROLE') throw new ValidationError('One or more roles do not exist');
      throw e;
    }
  }

  async update(id: string, patch: { email?: string }) {
    const before = await this.users.getById(id, 'User');
    if (patch.email && patch.email !== before.email && (await this.users.findOne({ email: patch.email }))) throw new ConflictError('Email already exists');
    await this.db.tx(async (conn) => {
      await this.users.update(id, { email: patch.email }, conn);
      await audit(this.db, conn, 'UserAccount', id, 'UPDATED', { email: before.email }, patch);
    });
    return this.get(id);
  }

  async assignRoles(id: string, roles: string[]) {
    const before = await this.users.rolesAndPermissions(id);
    await this.users.getById(id, 'User');
    await this.db.tx(async (conn) => {
      await this.setRolesChecked(id, roles, conn);
      await audit(this.db, conn, 'UserAccount', id, 'ROLES_CHANGED', before.roles, roles);
    });
    await this.auth.invalidateSessions(id);
    return this.get(id);
  }

  async setStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<unknown> {
    const u = await this.users.getById(id, 'User');
    if (u.id === requestContext.user()?.userId && status === 'INACTIVE') throw new ForbiddenError('You cannot deactivate your own account');
    await this.db.tx(async (conn) => {
      await this.users.update(id, { status, failed_attempts: 0, locked_until: null }, conn);
      await audit(this.db, conn, 'UserAccount', id, status === 'ACTIVE' ? 'ACTIVATED' : 'DEACTIVATED', { status: u.status }, { status });
    });
    if (status === 'INACTIVE') await this.auth.invalidateSessions(id);
    return this.get(id);
  }

  async unlock(id: string) {
    await this.users.getById(id, 'User');
    await this.users.update(id, { failed_attempts: 0, locked_until: null, status: 'ACTIVE' });
    return this.get(id);
  }

  async linkEmployee(id: string, employeeId: string | null) {
    await this.users.getById(id, 'User');
    if (employeeId) {
      const other = await this.users.findOne({ employee_id: employeeId });
      if (other && other.id !== id) throw new ConflictError('Employee is already linked to another account');
    }
    await this.users.update(id, { employee_id: employeeId });
    await audit(this.db, undefined, 'UserAccount', id, 'EMPLOYEE_LINKED', undefined, { employeeId });
    return this.get(id);
  }

  async adminResetPassword(id: string, password: string) {
    await this.users.getById(id, 'User');
    await this.users.update(id, { password_hash: await bcrypt.hash(password, 10), must_change_password: 1, password_changed_at: new Date(), failed_attempts: 0, locked_until: null });
    await this.auth.invalidateSessions(id);
    await audit(this.db, undefined, 'UserAccount', id, 'PASSWORD_RESET_BY_ADMIN');
  }

  listRoles() { return this.roles.listWithPermissions().then((rows) => rows.map((r) => ({ id: r.id, name: r.name, description: r.description, permissions: r.permissions ? String(r.permissions).split(',') : [] }))); }
  listPermissions() { return this.permissions.findAll({}, { by: 'code' }).then((r) => r.map((p) => toDto(p, ['id', 'code', 'description']))); }

  async setRolePermissions(roleId: string, codes: string[]) {
    const role = await this.roles.findById(roleId);
    if (!role) throw new NotFoundError('Role', roleId);
    if (role.name === 'SUPER_ADMIN') throw new ForbiddenError('SUPER_ADMIN permissions are fixed');
    try {
      await this.db.tx(async (conn) => {
        await this.roles.replacePermissions(roleId, codes, conn);
        await audit(this.db, conn, 'Role', roleId, 'PERMISSIONS_CHANGED', undefined, codes);
      });
    } catch (e: any) { if (e.message === 'UNKNOWN_PERMISSION') throw new ValidationError('One or more permissions do not exist'); throw e; }
    return (await this.listRoles()).find((r) => r.id === roleId);
  }

  history(entityId?: string) { return auditTrail(this.db, 'UserAccount', entityId).then((rows) => rows.map((r) => toDto(r))); }
}
