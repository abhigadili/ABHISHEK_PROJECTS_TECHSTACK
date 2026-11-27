import 'server-only';
import { db } from '@/server/db';
import type { Prisma } from '@prisma/client';

const live = { deletedAt: null } as const;
export const hospitalRepo = {
  list(where: Prisma.HospitalWhereInput, skip: number, take: number) {
    const w = { ...live, ...where };
    return Promise.all([db.hospital.findMany({ where: w, orderBy: { name: 'asc' }, skip, take, include: { _count: { select: { departments: true, assignments: true } } } }), db.hospital.count({ where: w })]);
  },
  byId: (id: number) => db.hospital.findFirst({ where: { id, ...live }, include: { departments: { where: { active: true }, orderBy: { name: 'asc' } }, branches: { where: live }, parent: { select: { id: true, name: true } }, assignments: { include: { doctor: { include: { user: { select: { firstName: true, lastName: true } }, specialization: true } }, department: true } } } }),
  bySlug: (slug: string) => db.hospital.findFirst({ where: { slug, ...live, active: true }, include: { departments: { where: { active: true }, orderBy: { name: 'asc' } }, branches: { where: { ...live, active: true } } } }),
  create: (data: Prisma.HospitalUncheckedCreateInput) => db.hospital.create({ data }),
  update: (id: number, data: Prisma.HospitalUncheckedUpdateInput) => db.hospital.update({ where: { id }, data }),
  softDelete: (id: number) => db.hospital.update({ where: { id }, data: { deletedAt: new Date(), active: false } }),
  addDepartment: (hospitalId: number, d: { name: string; description?: string }) => db.department.create({ data: { hospitalId, ...d } }),
  department: (id: number) => db.department.findUnique({ where: { id } }),
  updateDepartment: (id: number, d: Prisma.DepartmentUpdateInput) => db.department.update({ where: { id }, data: d }),
  staff: (hospitalId: number) => db.user.findMany({ where: { hospitalId, deletedAt: null }, include: { role: true }, orderBy: { lastName: 'asc' } }),
  slugExists: async (slug: string) => !!(await db.hospital.findUnique({ where: { slug } })),
};
