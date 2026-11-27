import { prisma, Prisma, type Tx } from '../database/prisma';
export const routeInclude = { stops: { orderBy: { seq: 'asc' as const }, include: { station: true } } } satisfies Prisma.TrainRouteInclude;
export const trainInclude = {
  route: { include: routeInclude },
  schedules: { include: { operatingDays: true }, orderBy: { validFrom: 'asc' as const } },
  _count: { select: { coaches: true, bookings: true } },
} satisfies Prisma.TrainInclude;
export const trainRepo = {
  list: (where: Prisma.TrainWhereInput, skip: number, take: number, orderBy: Prisma.TrainOrderByWithRelationInput) => Promise.all([prisma.train.findMany({ where, include: trainInclude, orderBy, skip, take }), prisma.train.count({ where })]),
  byId: (id: number) => prisma.train.findUnique({ where: { id }, include: { ...trainInclude, overrides: { where: { date: { gte: new Date(new Date().toDateString()) } }, orderBy: { date: 'asc' } } } }),
  byNumber: (number: string) => prisma.train.findUnique({ where: { number } }),
  create: (tx: Tx, data: Prisma.TrainCreateInput) => tx.train.create({ data }),
  update: (id: number, data: Prisma.TrainUpdateInput) => prisma.train.update({ where: { id }, data }),
  remove: (id: number) => prisma.train.delete({ where: { id } }),
  bookingCount: (id: number) => prisma.booking.count({ where: { trainId: id } }),
  activeFutureBookings: (trainId: number) => prisma.booking.findMany({ where: { trainId, status: { in: ['CONFIRMED', 'PARTIALLY_CANCELLED'] }, departureAt: { gt: new Date() } }, select: { userId: true } }),
  replaceRoute: async (tx: Tx, trainId: number, name: string, stops: { stationId: number; arrivalTime?: string | null; departureTime?: string | null; dayOffset: number; distanceKm: number }[]) => {
    const existing = await tx.trainRoute.findUnique({ where: { trainId }, select: { id: true } });
    if (existing) { await tx.trainRouteStation.deleteMany({ where: { routeId: existing.id } }); await tx.trainRoute.update({ where: { id: existing.id }, data: { name } }); }
    const route = existing ?? (await tx.trainRoute.create({ data: { trainId, name } }));
    await tx.trainRouteStation.createMany({ data: stops.map((s, i) => ({ routeId: route.id, seq: i + 1, stationId: s.stationId, arrivalTime: i === 0 ? null : s.arrivalTime ?? null, departureTime: i === stops.length - 1 ? null : s.departureTime ?? null, dayOffset: s.dayOffset, distanceKm: s.distanceKm })) });
    return route.id;
  },
  routeFor: (trainId: number) => prisma.trainRoute.findUnique({ where: { trainId }, include: routeInclude }),
  routes: (skip: number, take: number, q?: string) => { const where: Prisma.TrainRouteWhereInput = q ? { OR: [{ name: { contains: q } }, { train: { name: { contains: q } } }, { train: { number: { contains: q } } }] } : {}; return Promise.all([prisma.trainRoute.findMany({ where, include: { ...routeInclude, train: { select: { id: true, number: true, name: true, status: true } } }, orderBy: { id: 'asc' }, skip, take }), prisma.trainRoute.count({ where })]); },
  routeById: (id: number) => prisma.trainRoute.findUnique({ where: { id }, include: { ...routeInclude, train: { select: { id: true, number: true, name: true, status: true } } } }),
};
export const scheduleRepo = {
  list: (where: Prisma.TrainScheduleWhereInput, skip: number, take: number) => Promise.all([prisma.trainSchedule.findMany({ where, include: { operatingDays: true, train: { select: { id: true, number: true, name: true } } }, orderBy: [{ trainId: 'asc' }, { validFrom: 'asc' }], skip, take }), prisma.trainSchedule.count({ where })]),
  byId: (id: number) => prisma.trainSchedule.findUnique({ where: { id }, include: { operatingDays: true, train: { select: { id: true, number: true, name: true } } } }),
  create: (d: { trainId: number; validFrom: Date; validTo: Date | null; active: boolean; notes?: string; days: number[] }) => prisma.trainSchedule.create({ data: { trainId: d.trainId, validFrom: d.validFrom, validTo: d.validTo, active: d.active, notes: d.notes, operatingDays: { create: d.days.map((dayOfWeek) => ({ dayOfWeek })) } }, include: { operatingDays: true } }),
  update: (id: number, d: { validFrom: Date; validTo: Date | null; active: boolean; notes?: string; days: number[] }) => prisma.$transaction(async (tx) => { await tx.trainOperatingDay.deleteMany({ where: { scheduleId: id } }); return tx.trainSchedule.update({ where: { id }, data: { validFrom: d.validFrom, validTo: d.validTo, active: d.active, notes: d.notes, operatingDays: { create: d.days.map((dayOfWeek) => ({ dayOfWeek })) } }, include: { operatingDays: true } }); }),
  remove: (id: number) => prisma.trainSchedule.delete({ where: { id } }),
  overrides: { upsert: (trainId: number, date: Date, cancelled: boolean, reason?: string) => prisma.trainDateOverride.upsert({ where: { trainId_date: { trainId, date } }, create: { trainId, date, cancelled, reason }, update: { cancelled, reason } }), remove: (trainId: number, id: number) => prisma.trainDateOverride.deleteMany({ where: { id, trainId } }) },
};
export const coachRepo = {
  types: () => prisma.coachType.findMany({ orderBy: { id: 'asc' } }),
  seatTypes: () => prisma.seatType.findMany(),
  forTrain: (trainId: number) => prisma.trainCoach.findMany({ where: { trainId }, include: { coachType: true, _count: { select: { seats: true } } }, orderBy: [{ coachTypeId: 'asc' }, { number: 'asc' }] }),
  byId: (id: number) => prisma.trainCoach.findUnique({ where: { id }, include: { coachType: true, train: { select: { id: true, number: true, name: true } } } }),
  seats: (coachId: number) => prisma.coachSeat.findMany({ where: { coachId }, include: { seatType: true }, orderBy: { seatNumber: 'asc' } }),
  create: async (tx: Tx, trainId: number, coachTypeId: number, number: string, layout: string, count: number, seatTypeIds: Map<string, number>, typeFor: (l: string, i: number) => string) => {
    const coach = await tx.trainCoach.create({ data: { trainId, coachTypeId, number } });
    await tx.coachSeat.createMany({ data: Array.from({ length: count }, (_, i) => ({ coachId: coach.id, seatNumber: i + 1, seatTypeId: seatTypeIds.get(typeFor(layout, i))! })) });
    return coach;
  },
  numbersFor: (trainId: number) => prisma.trainCoach.findMany({ where: { trainId }, select: { number: true } }),
  hasBookings: (coachId: number) => prisma.bookingSeat.count({ where: { seat: { coachId } } }),
  remove: (id: number) => prisma.trainCoach.delete({ where: { id } }),
  seatById: (id: number) => prisma.coachSeat.findUnique({ where: { id }, include: { coach: true } }),
  setSeatStatus: (id: number, status: 'ACTIVE' | 'BLOCKED') => prisma.coachSeat.update({ where: { id }, data: { status } }),
  activeReservationsForSeat: (seatId: number) => prisma.seatReservation.count({ where: { seatId, active: 1, journeyDate: { gte: new Date(new Date().toDateString()) } } }),
};
