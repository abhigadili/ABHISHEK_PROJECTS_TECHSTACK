import 'server-only';
import { db, type Tx } from '@/server/db';
import type { Prisma } from '@prisma/client';

export const appointmentInclude = {
  patient: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
  doctor: { include: { user: { select: { id: true, firstName: true, lastName: true } }, specialization: true } },
  hospital: { select: { id: true, name: true, slug: true } }, invoice: { select: { id: true, number: true, status: true } },
} satisfies Prisma.AppointmentInclude;

export const appointmentRepo = {
  list(where: Prisma.AppointmentWhereInput, skip: number, take: number, dir: 'asc' | 'desc') {
    return Promise.all([db.appointment.findMany({ where, include: appointmentInclude, orderBy: { startsAt: dir }, skip, take }), db.appointment.count({ where })]);
  },
  byId: (id: number) => db.appointment.findUnique({ where: { id }, include: appointmentInclude }),
  /** Non-cancelled appointments of a doctor overlapping [from, to). */
  overlapping: (tx: Pick<Tx, 'appointment'>, where: { doctorId?: number; patientId?: number }, from: Date, to: Date, excludeId?: number) =>
    tx.appointment.findFirst({ where: { ...where, status: { notIn: ['CANCELLED'] }, startsAt: { lt: to }, endsAt: { gt: from }, ...(excludeId ? { id: { not: excludeId } } : {}) } }),
  booked: (doctorId: number, from: Date, to: Date) => db.appointment.findMany({ where: { doctorId, status: { notIn: ['CANCELLED'] }, startsAt: { gte: from, lt: to } }, select: { startsAt: true, endsAt: true } }),
};
