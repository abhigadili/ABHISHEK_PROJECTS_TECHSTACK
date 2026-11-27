import { Prisma } from '../database/prisma';
import { userRepo, tokenRepo } from '../repositories/user.repository';
import { badRequest, forbidden, notFound } from '../utils/errors';
import { toUserDto } from '../utils/serializers';
import { clearPermissionCache } from './rbac.service';
import type { RoleKey } from '../constants/rbac';
export const userService = {
  async list(q: { page: number; size: number; q?: string; sort?: string; dir: 'asc' | 'desc'; role?: string; status?: string }) {
    const where: Prisma.UserWhereInput = { ...(q.role ? { roles: { some: { role: { key: q.role } } } } : {}), ...(q.status ? { status: q.status as never } : {}), ...(q.q ? { OR: [{ name: { contains: q.q } }, { email: { contains: q.q } }, { mobile: { contains: q.q } }] } : {}) };
    const sortable = ['name', 'email', 'createdAt', 'lastLoginAt']; const orderBy = { [sortable.includes(q.sort ?? '') ? q.sort! : 'createdAt']: q.dir } as Prisma.UserOrderByWithRelationInput;
    const [items, total] = await userRepo.list(where, q.page * q.size, q.size, orderBy); return { items: items.map(toUserDto), total };
  },
  /** Resource-level authorization: a user may read/update only themselves unless they hold the permission. */
  async get(id: number, actor: { id: number }, canRead: boolean) { if (id !== actor.id && !canRead) throw forbidden(); const u = await userRepo.byId(id); if (!u) throw notFound('User'); return toUserDto(u); },
  async update(id: number, actor: { id: number }, canManage: boolean, d: { name: string; mobile: string }) {
    if (id !== actor.id && !canManage) throw forbidden(); if (!(await userRepo.byId(id))) throw notFound('User');
    try { return toUserDto(await userRepo.update(id, d)); } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw badRequest('That mobile number is already used', { mobile: 'Already used' }); throw e; }
  },
  async setStatus(id: number, actorId: number, status: 'ACTIVE' | 'SUSPENDED' | 'PENDING') {
    if (id === actorId && status !== 'ACTIVE') throw badRequest('You cannot suspend your own account');
    if (!(await userRepo.byId(id))) throw notFound('User');
    const u = await userRepo.update(id, { status }); if (status !== 'ACTIVE') await tokenRepo.revokeAllForUser(id); return toUserDto(u);
  },
  async setRoles(id: number, actorId: number, roles: RoleKey[]) {
    if (id === actorId && !roles.includes('ADMIN')) throw badRequest('You cannot remove your own administrator role');
    if (!(await userRepo.byId(id))) throw notFound('User');
    await userRepo.setRoles(id, roles); await tokenRepo.revokeAllForUser(id); clearPermissionCache(); return toUserDto((await userRepo.byId(id))!);
  },
  async remove(id: number, actorId: number) { if (id === actorId) throw badRequest('You cannot delete yourself'); if (!(await userRepo.byId(id))) throw notFound('User'); await userRepo.softDelete(id); await tokenRepo.revokeAllForUser(id); },
};
