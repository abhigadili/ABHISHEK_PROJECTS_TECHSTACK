import { prisma } from '../database/prisma';
import { env } from '../config/env';
import { badRequest, notFound } from '../utils/errors';
import { addDays, atTime, dayOfWeek, minutesBetween, toDateOnly } from '../utils/dates';
import type { SearchQuery } from '../validations/booking';

type Stop = { seq: number; stationId: number; arrivalTime: string | null; departureTime: string | null; dayOffset: number; distanceKm: number; station: { id: number; code: string; name: string; city: string } };
export interface RunInfo { trainId: number; runDate: Date; fromStop: Stop; toStop: Stop; departureAt: Date; arrivalAt: Date; distanceKm: number; durationMinutes: number }

/** Releases seat holds whose payment window elapsed (called lazily before every availability read and by a timer). */
export async function releaseExpiredHolds(): Promise<number> {
  const due = await prisma.booking.findMany({ where: { status: 'PENDING_PAYMENT', expiresAt: { lt: new Date() } }, select: { id: true } });
  if (!due.length) return 0;
  const ids = due.map((b) => b.id);
  await prisma.$transaction([
    prisma.seatReservation.updateMany({ where: { bookingSeat: { bookingPassenger: { bookingId: { in: ids } } }, active: 1 }, data: { active: null } }),
    prisma.bookingSeat.updateMany({ where: { bookingPassenger: { bookingId: { in: ids } } }, data: { status: 'RELEASED' } }),
    prisma.booking.updateMany({ where: { id: { in: ids }, status: 'PENDING_PAYMENT' }, data: { status: 'EXPIRED' } }),
  ]);
  return ids.length;
}

/** Is the train operating on this run date (origin date)? Active status + schedule validity + operating weekday + no cancelled-date override. */
export async function operatingReason(train: { id: number; status: string }, runDate: Date): Promise<string | null> {
  if (train.status !== 'ACTIVE') return `Train is ${train.status.toLowerCase()}`;
  const override = await prisma.trainDateOverride.findUnique({ where: { trainId_date: { trainId: train.id, date: runDate } } });
  if (override?.cancelled) return override.reason ? `Cancelled on this date: ${override.reason}` : 'Cancelled on this date';
  const schedules = await prisma.trainSchedule.findMany({ where: { trainId: train.id, active: true, validFrom: { lte: runDate } }, include: { operatingDays: true } });
  const ok = schedules.some((s) => (!s.validTo || s.validTo >= runDate) && s.operatingDays.some((d) => d.dayOfWeek === dayOfWeek(runDate)));
  return ok ? null : 'Train does not run on this day';
}

/** Resolve a (train, boarding date, from, to) request to a concrete RUN. `date` is the BOARDING date at the source station. */
export async function resolveRun(trainId: number, boardingDate: string, fromStationId: number, toStationId: number, opts: { requireFuture?: boolean } = {}): Promise<RunInfo> {
  await releaseExpiredHolds();
  const train = await prisma.train.findUnique({ where: { id: trainId }, include: { route: { include: { stops: { orderBy: { seq: 'asc' }, include: { station: true } } } } } });
  if (!train || !train.route) throw notFound('Train');
  const fromStop = train.route.stops.find((s) => s.stationId === fromStationId); const toStop = train.route.stops.find((s) => s.stationId === toStationId);
  if (!fromStop || !toStop || fromStop.seq >= toStop.seq) throw badRequest('This train does not travel between the selected stations in that direction');
  const runDate = addDays(toDateOnly(boardingDate), -fromStop.dayOffset);
  const reason = await operatingReason(train, runDate); if (reason) throw badRequest(reason);
  const departureAt = atTime(runDate, fromStop.departureTime!, fromStop.dayOffset); const arrivalAt = atTime(runDate, toStop.arrivalTime!, toStop.dayOffset);
  if (opts.requireFuture && departureAt <= new Date()) throw badRequest('This train has already departed');
  return { trainId, runDate, fromStop: fromStop as Stop, toStop: toStop as Stop, departureAt, arrivalAt, distanceKm: toStop.distanceKm - fromStop.distanceKm, durationMinutes: minutesBetween(departureAt, arrivalAt) };
}

export async function reservationFee(): Promise<number> { const s = await prisma.appSetting.findUnique({ where: { key: 'reservationFee' } }); return s ? Number(s.value) : 0; }
export const fareFor = (farePerKm: unknown, distanceKm: number, fee: number) => Math.round((Number(farePerKm) * distanceKm + fee) * 100) / 100;

/** Seat ids that are occupied on ANY segment of [fromSeq, toSeq) for the given run date. Segment model: a seat freed at stop k can be sold for k..n. */
export async function occupiedSeatIds(trainId: number, runDate: Date, fromSeq: number, toSeq: number): Promise<Set<number>> {
  const rows = await prisma.seatReservation.findMany({ where: { journeyDate: runDate, active: 1, segmentSeq: { gte: fromSeq, lt: toSeq }, seat: { coach: { trainId } } }, select: { seatId: true }, distinct: ['seatId'] });
  return new Set(rows.map((r) => r.seatId));
}

export interface SearchRow {
  train: { id: number; number: string; name: string; type: string }; runDate: string;
  from: { station: Stop['station']; departure: Date; seq: number }; to: { station: Stop['station']; arrival: Date; seq: number };
  distanceKm: number; durationMinutes: number; classes: { coachTypeId: number; code: string; name: string; total: number; available: number; fare: number; status: string }[]; minFare: number;
}

export const availabilityService = {
  /** Scenario 2: matching trains with timings, classes, availability and fares. */
  async search(q: SearchQuery) {
    await releaseExpiredHolds();
    const [fromStops, toStops] = await Promise.all([prisma.trainRouteStation.findMany({ where: { stationId: q.from }, select: { routeId: true, seq: true } }), prisma.trainRouteStation.findMany({ where: { stationId: q.to }, select: { routeId: true, seq: true } })]);
    const toBy = new Map(toStops.map((s) => [s.routeId, s.seq])); const routeIds = fromStops.filter((s) => (toBy.get(s.routeId) ?? 0) > s.seq).map((s) => s.routeId);
    const trains = await prisma.train.findMany({ where: { route: { id: { in: routeIds } }, ...(q.type ? { type: q.type as never } : {}) }, include: { route: { include: { stops: { orderBy: { seq: 'asc' }, include: { station: true } } } }, coaches: { include: { coachType: true, seats: { where: { status: 'ACTIVE' }, select: { id: true } } } } } });
    const fee = await reservationFee(); const results: SearchRow[] = [];
    for (const t of trains) {
      let run: RunInfo; try { run = await resolveRun(t.id, q.date, q.from, q.to); } catch { continue; }
      if (run.departureAt <= new Date()) continue;
      if (q.departAfter && `${String(run.departureAt.getHours()).padStart(2, '0')}:${String(run.departureAt.getMinutes()).padStart(2, '0')}` < q.departAfter) continue;
      const occupied = await occupiedSeatIds(t.id, run.runDate, run.fromStop.seq, run.toStop.seq);
      const byType = new Map<number, { coachType: (typeof t.coaches)[number]['coachType']; total: number; available: number }>();
      for (const c of t.coaches) { const e = byType.get(c.coachTypeId) ?? { coachType: c.coachType, total: 0, available: 0 }; for (const s of c.seats) { e.total++; if (!occupied.has(s.id)) e.available++; } byType.set(c.coachTypeId, e); }
      let classes = [...byType.values()].map((e) => ({ coachTypeId: e.coachType.id, code: e.coachType.code, name: e.coachType.name, total: e.total, available: e.available, fare: fareFor(e.coachType.farePerKm, run.distanceKm, fee), status: e.available > 0 ? 'AVAILABLE' : 'SOLD_OUT' }));
      if (q.coachTypeId) classes = classes.filter((c) => c.coachTypeId === q.coachTypeId);
      if (!classes.length || classes.every((c) => c.available < Math.max(q.minSeats, 0))) continue;
      results.push({ train: { id: t.id, number: t.number, name: t.name, type: t.type }, runDate: run.runDate.toISOString().slice(0, 10), from: { station: run.fromStop.station, departure: run.departureAt, seq: run.fromStop.seq }, to: { station: run.toStop.station, arrival: run.arrivalAt, seq: run.toStop.seq }, distanceKm: run.distanceKm, durationMinutes: run.durationMinutes, classes, minFare: Math.min(...classes.map((c) => c.fare)) });
    }
    const sorters = { departure: (a: SearchRow, b: SearchRow) => +a.from.departure - +b.from.departure, duration: (a: SearchRow, b: SearchRow) => a.durationMinutes - b.durationMinutes, fare: (a: SearchRow, b: SearchRow) => a.minFare - b.minFare, name: (a: SearchRow, b: SearchRow) => a.train.name.localeCompare(b.train.name) };
    return results.sort(sorters[q.sort]);
  },
  /** Seat map (Scenario 3 steps 4-7): every seat of the chosen class with AVAILABLE / BOOKED / BLOCKED status for the requested segment. */
  async seatMap(trainId: number, date: string, from: number, to: number, coachTypeId: number) {
    const run = await resolveRun(trainId, date, from, to); const occupied = await occupiedSeatIds(trainId, run.runDate, run.fromStop.seq, run.toStop.seq); const fee = await reservationFee();
    const coaches = await prisma.trainCoach.findMany({ where: { trainId, coachTypeId }, include: { coachType: true, seats: { include: { seatType: true }, orderBy: { seatNumber: 'asc' } } }, orderBy: { number: 'asc' } });
    if (!coaches.length) throw notFound('Coaches of that class');
    return { runDate: run.runDate.toISOString().slice(0, 10), fare: fareFor(coaches[0].coachType.farePerKm, run.distanceKm, fee), coachType: coaches[0].coachType, coaches: coaches.map((c) => ({ id: c.id, number: c.number, seats: c.seats.map((s) => ({ id: s.id, number: s.seatNumber, type: s.seatType.code, status: s.status === 'BLOCKED' ? 'BLOCKED' : occupied.has(s.id) ? 'BOOKED' : 'AVAILABLE' })) })) };
  },
  async trainAvailability(trainId: number, date: string, from?: number, to?: number) {
    const train = await prisma.train.findUnique({ where: { id: trainId }, include: { route: { include: { stops: { orderBy: { seq: 'asc' }, include: { station: true } } } } } });
    if (!train?.route) throw notFound('Train'); const stops = train.route.stops;
    const f = from ?? stops[0].stationId; const t = to ?? stops[stops.length - 1].stationId;
    const run = await resolveRun(trainId, date, f, t); const occupied = await occupiedSeatIds(trainId, run.runDate, run.fromStop.seq, run.toStop.seq);
    const coaches = await prisma.trainCoach.findMany({ where: { trainId }, include: { coachType: true, seats: { select: { id: true, status: true } } } }); const fee = await reservationFee();
    const classes = new Map<number, { coachType: string; code: string; total: number; available: number; fare: number }>();
    for (const c of coaches) { const e = classes.get(c.coachTypeId) ?? { coachType: c.coachType.name, code: c.coachType.code, total: 0, available: 0, fare: fareFor(c.coachType.farePerKm, run.distanceKm, fee) }; for (const s of c.seats) if (s.status === 'ACTIVE') { e.total++; if (!occupied.has(s.id)) e.available++; } classes.set(c.coachTypeId, e); }
    return { trainId, date, from: run.fromStop.station, to: run.toStop.station, departure: run.departureAt, arrival: run.arrivalAt, classes: [...classes.values()], holdMinutes: env.SEAT_HOLD_MINUTES };
  },
};
