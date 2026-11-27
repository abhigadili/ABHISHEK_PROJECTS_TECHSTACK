import { prisma, Prisma, type Tx } from '../database/prisma';
const withRoles = { roles: { select: { role: { select: { key: true, name: true } } } } } satisfies Prisma.UserInclude;
export type UserWithRoles = Prisma.UserGetPayload<{ include: typeof withRoles }>;
export const userRepo = {
  byEmail: (email: string) => prisma.user.findFirst({ where: { email, deletedAt: null }, include: withRoles }),
  byId: (id: number) => prisma.user.findFirst({ where: { id, deletedAt: null }, include: withRoles }),
  existsEmailOrMobile: (email: string, mobile: string) => prisma.user.findFirst({ where: { OR: [{ email }, { mobile }] }, select: { email: true, mobile: true } }),
  create: async (tx: Tx, d: { name: string; email: string; mobile: string; passwordHash: string }, roleKey: string) => {
    const role = await tx.role.findUniqueOrThrow({ where: { key: roleKey } });
    return tx.user.create({ data: { ...d, roles: { create: { roleId: role.id } }, preferences: { create: {} } }, include: withRoles });
  },
  list: (where: Prisma.UserWhereInput, skip: number, take: number, orderBy: Prisma.UserOrderByWithRelationInput) => Promise.all([prisma.user.findMany({ where: { deletedAt: null, ...where }, include: withRoles, orderBy, skip, take }), prisma.user.count({ where: { deletedAt: null, ...where } })]),
  update: (id: number, data: Prisma.UserUpdateInput) => prisma.user.update({ where: { id }, data, include: withRoles }),
  setRoles: (id: number, roleKeys: string[]) => prisma.$transaction(async (tx) => { const roles = await tx.role.findMany({ where: { key: { in: roleKeys } } }); await tx.userRole.deleteMany({ where: { userId: id } }); await tx.userRole.createMany({ data: roles.map((r) => ({ userId: id, roleId: r.id })) }); }),
  recordFailure: (id: number, fails: number, lock: Date | null) => prisma.user.update({ where: { id }, data: { failedLogins: fails, lockedUntil: lock } }),
  recordLogin: (id: number) => prisma.user.update({ where: { id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } }),
  softDelete: (id: number) => prisma.user.update({ where: { id }, data: { deletedAt: new Date(), status: 'SUSPENDED' } }),
};
export const tokenRepo = {
  createRefresh: (d: { userId: number; tokenHash: string; familyId: string; expiresAt: Date; userAgent?: string }) => prisma.refreshToken.create({ data: d }),
  findRefresh: (tokenHash: string) => prisma.refreshToken.findUnique({ where: { tokenHash } }),
  revoke: (id: number) => prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } }),
  revokeFamily: (familyId: string) => prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } }),
  revokeAllForUser: (userId: number, exceptHash?: string) => prisma.refreshToken.updateMany({ where: { userId, revokedAt: null, ...(exceptHash ? { tokenHash: { not: exceptHash } } : {}) }, data: { revokedAt: new Date() } }),
  createReset: (d: { userId: number; tokenHash: string; expiresAt: Date }) => prisma.passwordResetToken.create({ data: d }),
  findReset: (tokenHash: string) => prisma.passwordResetToken.findUnique({ where: { tokenHash } }),
  useReset: (id: number) => prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } }),
};
