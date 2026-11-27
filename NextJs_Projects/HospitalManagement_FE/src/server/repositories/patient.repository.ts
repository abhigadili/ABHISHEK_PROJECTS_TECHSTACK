import 'server-only';
import { db } from '@/server/db';
import type { Prisma } from '@prisma/client';

const withUser = { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } } } satisfies Prisma.PatientInclude;
export const patientRepo = {
  list(where: Prisma.PatientWhereInput, skip: number, take: number) {
    const w = { deletedAt: null, ...where };
    return Promise.all([db.patient.findMany({ where: w, include: withUser, orderBy: { user: { lastName: 'asc' } }, skip, take }), db.patient.count({ where: w })]);
  },
  byId: (id: number) => db.patient.findFirst({ where: { id, deletedAt: null }, include: withUser }),
  byUserId: (userId: number) => db.patient.findFirst({ where: { userId, deletedAt: null }, include: withUser }),
  update: (id: number, userId: number, u: Prisma.UserUpdateInput, d: Prisma.PatientUpdateInput) => db.$transaction([db.user.update({ where: { id: userId }, data: u }), db.patient.update({ where: { id }, data: d })]),
};
