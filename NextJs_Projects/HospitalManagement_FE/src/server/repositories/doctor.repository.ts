import 'server-only';
import { db, type Tx } from '@/server/db';
import type { Prisma } from '@prisma/client';

const card = { user: { select: { firstName: true, lastName: true, email: true, phone: true } }, specialization: true, assignments: { include: { hospital: { select: { id: true, name: true, slug: true, city: true } }, department: true } } } satisfies Prisma.DoctorInclude;
export const doctorRepo = {
  list(where: Prisma.DoctorWhereInput, skip: number, take: number, orderBy: Prisma.DoctorOrderByWithRelationInput = { user: { lastName: 'asc' } }) {
    const w: Prisma.DoctorWhereInput = { deletedAt: null, active: true, ...where };
    return Promise.all([db.doctor.findMany({ where: w, include: card, orderBy, skip, take }), db.doctor.count({ where: w })]);
  },
  byId: (id: number) => db.doctor.findFirst({ where: { id, deletedAt: null }, include: { ...card, availability: { orderBy: { dayOfWeek: 'asc' } }, timeOff: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' } } } }),
  byUserId: (userId: number) => db.doctor.findFirst({ where: { userId, deletedAt: null }, include: card }),
  specializations: () => db.doctorSpecialization.findMany({ orderBy: { name: 'asc' } }),
  create: (tx: Tx, data: Prisma.DoctorUncheckedCreateInput) => tx.doctor.create({ data }),
  update: (id: number, data: Prisma.DoctorUpdateInput) => db.doctor.update({ where: { id }, data }),
  assign: (tx: Tx, doctorId: number, hospitalId: number, departmentId: number | null) => tx.doctorHospitalAssignment.upsert({ where: { doctorId_hospitalId: { doctorId, hospitalId } }, create: { doctorId, hospitalId, departmentId }, update: { departmentId } }),
  unassign: (doctorId: number, hospitalId: number) => db.doctorHospitalAssignment.delete({ where: { doctorId_hospitalId: { doctorId, hospitalId } } }),
  assignment: (doctorId: number, hospitalId: number) => db.doctorHospitalAssignment.findUnique({ where: { doctorId_hospitalId: { doctorId, hospitalId } } }),
  availability: (doctorId: number, hospitalId?: number) => db.doctorAvailability.findMany({ where: { doctorId, ...(hospitalId ? { hospitalId } : {}) }, orderBy: { dayOfWeek: 'asc' } }),
  replaceAvailability: (doctorId: number, hospitalId: number, rows: Prisma.DoctorAvailabilityCreateManyInput[]) => db.$transaction([db.doctorAvailability.deleteMany({ where: { doctorId, hospitalId } }), db.doctorAvailability.createMany({ data: rows })]),
  timeOff: (doctorId: number, date: Date) => db.doctorTimeOff.findUnique({ where: { doctorId_date: { doctorId, date } } }),
  addTimeOff: (doctorId: number, date: Date, reason: string) => db.doctorTimeOff.upsert({ where: { doctorId_date: { doctorId, date } }, create: { doctorId, date, reason: reason || null }, update: { reason: reason || null } }),
  removeTimeOff: (id: number, doctorId: number) => db.doctorTimeOff.deleteMany({ where: { id, doctorId } }),
};
