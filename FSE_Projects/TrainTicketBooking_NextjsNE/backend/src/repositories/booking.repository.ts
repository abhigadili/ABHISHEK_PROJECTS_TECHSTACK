import { prisma, Prisma } from '../database/prisma';
export const bookingInclude = {
  train: { select: { id: true, number: true, name: true, type: true } }, fromStation: true, toStation: true, coachType: true, pnr: true,
  passengers: { include: { seat: { include: { seat: { include: { seatType: true, coach: { select: { number: true } } } } } } }, orderBy: { id: 'asc' as const } },
  payments: { orderBy: { createdAt: 'desc' as const }, include: { refunds: true } }, refunds: true, cancellations: { orderBy: { createdAt: 'desc' as const } },
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.BookingInclude;
export const bookingRepo = {
  list: (where: Prisma.BookingWhereInput, skip: number, take: number, orderBy: Prisma.BookingOrderByWithRelationInput) => Promise.all([prisma.booking.findMany({ where, include: bookingInclude, orderBy, skip, take }), prisma.booking.count({ where })]),
  byId: (id: number) => prisma.booking.findUnique({ where: { id }, include: bookingInclude }),
  byPnr: (pnr: string) => prisma.pnrRecord.findUnique({ where: { pnr }, include: { booking: { include: bookingInclude } } }),
  settings: () => prisma.appSetting.findMany(),
  rules: () => prisma.cancellationRule.findMany({ orderBy: { minHoursBefore: 'desc' } }),
  cancellations: (skip: number, take: number) => Promise.all([prisma.cancellationRecord.findMany({ include: { booking: { include: { pnr: true, train: { select: { number: true, name: true } }, user: { select: { name: true, email: true } } } }, refund: true }, orderBy: { createdAt: 'desc' }, skip, take }), prisma.cancellationRecord.count()]),
};
