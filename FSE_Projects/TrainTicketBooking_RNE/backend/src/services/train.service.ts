import { prisma } from '../database/prisma';
import { coachRepo, scheduleRepo, trainRepo } from '../repositories/train.repository';
import { badRequest, conflict, notFound } from '../utils/errors';
import { toDateOnly } from '../utils/dates';
import { seatTypeFor } from '../utils/seatLayout';
import { notify } from './notification.service';
import type { RouteInput, ScheduleInput, TrainInput } from '../validations/catalog';

/** Tell every passenger with an upcoming confirmed booking on this train that something changed (Notification Management: schedule change). */
async function notifySchedulePassengers(trainId: number, title: string, message: string) {
  const users = await trainRepo.activeFutureBookings(trainId);
  if (users.length) await notify(users.map((u) => u.userId), { type: 'SCHEDULE_CHANGE', title, message, link: '/bookings' });
}
async function createCoaches(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], trainId: number, plan: { coachTypeId: number; count: number }[], startIndex: Map<number, number> = new Map()) {
  const types = new Map((await tx.coachType.findMany()).map((t) => [t.id, t])); const seatTypes = new Map((await tx.seatType.findMany()).map((s) => [s.code, s.id]));
  for (const p of plan) {
    const t = types.get(p.coachTypeId); if (!t) throw badRequest('Unknown coach type');
    const prefix = t.code === 'SL' ? 'S' : t.code === '1A' ? 'H' : t.code === '2A' ? 'A' : t.code === '3A' ? 'B' : t.code === 'CC' ? 'C' : 'D';
    const taken = new Set((await tx.trainCoach.findMany({ where: { trainId }, select: { number: true } })).map((c) => c.number)); let n = startIndex.get(p.coachTypeId) ?? 1;
    for (let i = 0; i < p.count; i++) { while (taken.has(`${prefix}${n}`)) n++; const number = `${prefix}${n}`; taken.add(number); await coachRepo.create(tx, trainId, t.id, number, t.berthLayout, t.seatsPerCoach, seatTypes, seatTypeFor); }
  }
}
const stationIdsOf = (r: { stops: { stationId: number }[] }) => r.stops.map((s) => s.stationId).join(',');

export const trainService = {
  async list(q: { page: number; size: number; q?: string; sort?: string; dir: 'asc' | 'desc'; status?: string; type?: string }) {
    const where = { ...(q.status ? { status: q.status as never } : {}), ...(q.type ? { type: q.type as never } : {}), ...(q.q ? { OR: [{ name: { contains: q.q } }, { number: { contains: q.q } }] } : {}) };
    const sortable = ['number', 'name', 'type', 'status', 'createdAt']; const [items, total] = await trainRepo.list(where, q.page * q.size, q.size, { [sortable.includes(q.sort ?? '') ? q.sort! : 'number']: q.dir });
    return { items, total };
  },
  async get(id: number) { const t = await trainRepo.byId(id); if (!t) throw notFound('Train'); return t; },
  /** Train registration: train + route + operating schedule + coaches/seats created atomically. */
  async create(d: TrainInput) {
    if (await trainRepo.byNumber(d.number)) throw conflict('Train number already exists', { number: 'Already exists' });
    if (d.route) await this.assertStations(d.route);
    const id = await prisma.$transaction(async (tx) => {
      const t = await trainRepo.create(tx, { number: d.number, name: d.name, type: d.type, status: d.status });
      if (d.route) await trainRepo.replaceRoute(tx, t.id, d.route.name, d.route.stops);
      if (d.operatingDays?.length) await tx.trainSchedule.create({ data: { trainId: t.id, validFrom: toDateOnly(new Date().toISOString().slice(0, 10)), active: true, operatingDays: { create: d.operatingDays.map((dayOfWeek) => ({ dayOfWeek })) } } });
      if (d.coaches?.length) await createCoaches(tx, t.id, d.coaches);
      return t.id;
    });
    return this.get(id);
  },
  async assertStations(r: RouteInput) { const found = await prisma.station.count({ where: { id: { in: r.stops.map((s) => s.stationId) }, active: true } }); if (found !== r.stops.length) throw badRequest('One or more route stations do not exist or are inactive'); },
  async update(id: number, d: { name: string; type: string; status: string; route?: RouteInput }) {
    const cur = await this.get(id);
    if (d.route) {
      await this.assertStations(d.route);
      if (cur.route && stationIdsOf(cur.route) !== stationIdsOf(d.route) && (await trainRepo.activeFutureBookings(id)).length) throw conflict('The stop sequence cannot change while upcoming confirmed bookings exist - only timings can be edited');
      if (!cur.route || stationIdsOf(cur.route) !== stationIdsOf(d.route)) { if (await prisma.booking.count({ where: { trainId: id, status: { in: ['PENDING_PAYMENT', 'CONFIRMED', 'PARTIALLY_CANCELLED'] } } })) throw conflict('The stop sequence cannot change while bookings exist'); }
    }
    await prisma.$transaction(async (tx) => { await tx.train.update({ where: { id }, data: { name: d.name, type: d.type as never, status: d.status as never } }); if (d.route) await trainRepo.replaceRoute(tx, id, d.route.name, d.route.stops); });
    if (d.route) await notifySchedulePassengers(id, `Schedule updated: ${cur.number} ${d.name}`, 'Station timings of your train were updated. Please review your ticket.');
    return this.get(id);
  },
  async setStatus(id: number, status: string, reason?: string) {
    const cur = await this.get(id); await trainRepo.update(id, { status: status as never });
    if (status !== 'ACTIVE' && cur.status === 'ACTIVE') await notifySchedulePassengers(id, `Train ${cur.number} ${status.toLowerCase()}`, `${cur.name} is now ${status.toLowerCase()}.${reason ? ' Reason: ' + reason : ''} Cancel your booking for a refund if needed.`);
    return this.get(id);
  },
  async remove(id: number) { await this.get(id); if (await trainRepo.bookingCount(id)) throw conflict('This train has bookings - deactivate it instead'); await trainRepo.remove(id); },

  routes: async (q: { page: number; size: number; q?: string }) => { const [items, total] = await trainRepo.routes(q.page * q.size, q.size, q.q); return { items, total }; },
  async route(id: number) { const r = await trainRepo.routeById(id); if (!r) throw notFound('Route'); return r; },
  async createRoute(trainId: number, d: RouteInput) { await this.get(trainId); if (await trainRepo.routeFor(trainId)) throw conflict('This train already has a route - edit it instead'); await this.assertStations(d); await prisma.$transaction((tx) => trainRepo.replaceRoute(tx, trainId, d.name, d.stops)); return trainRepo.routeFor(trainId); },
  async updateRoute(id: number, d: RouteInput) { const r = await this.route(id); await this.update(r.trainId, { name: r.train.name, type: (await this.get(r.trainId)).type, status: r.train.status, route: d }); return this.route(id); },

  schedules: async (q: { page: number; size: number; trainId?: number }) => { const [items, total] = await scheduleRepo.list(q.trainId ? { trainId: q.trainId } : {}, q.page * q.size, q.size); return { items, total }; },
  async schedule(id: number) { const s = await scheduleRepo.byId(id); if (!s) throw notFound('Schedule'); return s; },
  async createSchedule(d: ScheduleInput) { const t = await this.get(d.trainId); const s = await scheduleRepo.create({ trainId: d.trainId, validFrom: toDateOnly(d.validFrom), validTo: d.validTo ? toDateOnly(d.validTo) : null, active: d.active, notes: d.notes, days: d.operatingDays }); await notifySchedulePassengers(d.trainId, `Schedule change: ${t.number}`, 'Operating days of your train were updated.'); return this.schedule(s.id); },
  async updateSchedule(id: number, d: ScheduleInput) { const cur = await this.schedule(id); const s = await scheduleRepo.update(id, { validFrom: toDateOnly(d.validFrom), validTo: d.validTo ? toDateOnly(d.validTo) : null, active: d.active, notes: d.notes, days: d.operatingDays }); await notifySchedulePassengers(cur.trainId, `Schedule change: ${cur.train.number}`, 'Operating days of your train were updated.'); return this.schedule(s.id); },
  async removeSchedule(id: number) { await this.schedule(id); await scheduleRepo.remove(id); },
  /** Train availability by date: cancel/restore a single run. */
  async setDateOverride(trainId: number, date: string, cancelled: boolean, reason?: string) {
    const t = await this.get(trainId); const o = await scheduleRepo.overrides.upsert(trainId, toDateOnly(date), cancelled, reason);
    if (cancelled) await notifySchedulePassengers(trainId, `Train ${t.number} cancelled on ${date}`, `${t.name} will not run on ${date}.${reason ? ' Reason: ' + reason : ''} Please cancel your ticket for a refund.`);
    return o;
  },
  async removeDateOverride(trainId: number, id: number) { await scheduleRepo.overrides.remove(trainId, id); },

  coachTypes: () => coachRepo.types(),
  seatTypes: () => coachRepo.seatTypes(),
  async coaches(trainId: number) { await this.get(trainId); return coachRepo.forTrain(trainId); },
  async addCoach(trainId: number, d: { coachTypeId: number; number: string }) {
    await this.get(trainId); if ((await coachRepo.numbersFor(trainId)).some((c) => c.number === d.number)) throw conflict('Coach number already used on this train', { number: 'Already used' });
    const type = (await coachRepo.types()).find((t) => t.id === d.coachTypeId); if (!type) throw badRequest('Unknown coach type'); const seatTypes = new Map((await coachRepo.seatTypes()).map((s) => [s.code, s.id]));
    return prisma.$transaction((tx) => coachRepo.create(tx, trainId, type.id, d.number, type.berthLayout, type.seatsPerCoach, seatTypes, seatTypeFor));
  },
  async removeCoach(id: number) { const c = await coachRepo.byId(id); if (!c) throw notFound('Coach'); if (await coachRepo.hasBookings(id)) throw conflict('This coach has bookings - block its seats instead'); await coachRepo.remove(id); },
  async seats(coachId: number) { const c = await coachRepo.byId(coachId); if (!c) throw notFound('Coach'); return { coach: c, seats: await coachRepo.seats(coachId) }; },
  async setSeatStatus(seatId: number, status: 'ACTIVE' | 'BLOCKED') {
    const s = await coachRepo.seatById(seatId); if (!s) throw notFound('Seat');
    if (status === 'BLOCKED' && (await coachRepo.activeReservationsForSeat(seatId))) throw conflict('This seat has upcoming reservations and cannot be blocked');
    return coachRepo.setSeatStatus(seatId, status);
  },
};
