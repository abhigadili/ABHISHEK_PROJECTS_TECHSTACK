import { prisma, Prisma, type Tx } from '../database/prisma';
import { env } from '../config/env';
import { bookingRepo } from '../repositories/booking.repository';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors';
import { fareFor, releaseExpiredHolds, reservationFee, resolveRun } from './availability.service';
import { notify } from './notification.service';
import { reference } from '../utils/crypto';
import type { CreateBookingInput } from '../validations/booking';

const ACTIVE = ['PENDING_PAYMENT', 'CONFIRMED', 'PARTIALLY_CANCELLED'];
export interface Actor { id: number; canReadAll: boolean; canCancelAny: boolean }

/** Segments occupied by a journey from stop `fromSeq` to stop `toSeq`: [fromSeq .. toSeq-1] */
const segmentsOf = (fromSeq: number, toSeq: number) => Array.from({ length: toSeq - fromSeq }, (_, i) => fromSeq + i);

export const bookingService = {
  /**
   * Scenario 3 steps 8-11. ONE transaction: lock the candidate seat rows (SELECT ... FOR UPDATE, ordered by id to avoid deadlocks),
   * re-check that no segment of the journey is reserved, then insert booking, passengers, seats and per-segment reservation rows.
   * UNIQUE(seat, date, segment, active) is the database-level backstop: a racing request that slips through fails with P2002 -> 409.
   */
  async create(userId: number, d: CreateBookingInput) {
    if (d.passengers.length > env.MAX_PASSENGERS_PER_BOOKING) throw badRequest(`At most ${env.MAX_PASSENGERS_PER_BOOKING} passengers per booking`);
    const run = await resolveRun(d.trainId, d.date, d.fromStationId, d.toStationId, { requireFuture: true });
    const coachType = await prisma.coachType.findUnique({ where: { id: d.coachTypeId } }); if (!coachType) throw badRequest('Unknown coach class');
    const fee = await reservationFee(); const fare = fareFor(coachType.farePerKm, run.distanceKm, fee); const segs = segmentsOf(run.fromStop.seq, run.toStop.seq);
    const wanted = d.passengers.map((p) => p.seatId).filter((x): x is number => !!x);
    try {
      const id = await prisma.$transaction(async (tx) => {
        const seatIds = wanted.length ? await this.lockChosen(tx, wanted, d.trainId, d.coachTypeId) : await this.lockAuto(tx, d.trainId, d.coachTypeId, run.runDate, segs, d.passengers.length);
        const busy = await tx.seatReservation.count({ where: { seatId: { in: seatIds }, journeyDate: run.runDate, active: 1, segmentSeq: { in: segs } } });
        if (busy) throw conflict('One of the selected seats was just taken - please choose again');
        const booking = await tx.booking.create({ data: { userId, trainId: d.trainId, journeyDate: run.runDate, fromStationId: d.fromStationId, toStationId: d.toStationId, fromSeq: run.fromStop.seq, toSeq: run.toStop.seq, coachTypeId: d.coachTypeId, status: 'PENDING_PAYMENT', totalAmount: Math.round(fare * d.passengers.length * 100) / 100, departureAt: run.departureAt, expiresAt: new Date(Date.now() + env.SEAT_HOLD_MINUTES * 60_000) } });
        for (let i = 0; i < d.passengers.length; i++) {
          const p = d.passengers[i];
          const bp = await tx.bookingPassenger.create({ data: { bookingId: booking.id, passengerId: p.passengerId ?? null, name: p.name, age: p.age, gender: p.gender, mobile: p.mobile || null, fare } });
          const bs = await tx.bookingSeat.create({ data: { bookingPassengerId: bp.id, seatId: seatIds[i], status: 'HELD' } });
          await tx.seatReservation.createMany({ data: segs.map((segmentSeq) => ({ seatId: seatIds[i], journeyDate: run.runDate, segmentSeq, bookingSeatId: bs.id, active: 1 })) });
        }
        return booking.id;
      }, { timeout: 15_000 });
      return this.get(id, { id: userId, canReadAll: false, canCancelAny: false });
    } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict('A seat was just taken by another booking - please choose again'); throw e; }
  },
  /** Passenger picked seats: validate they belong to a coach of the class on this train, are ACTIVE and lock them. */
  async lockChosen(tx: Tx, ids: number[], trainId: number, coachTypeId: number) {
    const rows = await tx.$queryRaw<{ id: number }[]>`SELECT s.id FROM coach_seats s JOIN train_coaches c ON c.id = s.coachId WHERE s.id IN (${Prisma.join(ids)}) AND c.trainId = ${trainId} AND c.coachTypeId = ${coachTypeId} AND s.status = 'ACTIVE' ORDER BY s.id FOR UPDATE`;
    if (rows.length !== ids.length) throw badRequest('One or more selected seats are invalid for this train/class');
    return ids;
  },
  /** Automatic allocation: lock a batch of candidate seats, keep those still free for every segment, take the first N (coach, seat order). */
  async lockAuto(tx: Tx, trainId: number, coachTypeId: number, runDate: Date, segs: number[], n: number) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const busy = await tx.seatReservation.findMany({ where: { journeyDate: runDate, active: 1, segmentSeq: { in: segs }, seat: { coach: { trainId, coachTypeId } } }, select: { seatId: true }, distinct: ['seatId'] });
      const candidates = await tx.coachSeat.findMany({ where: { status: 'ACTIVE', coach: { trainId, coachTypeId }, id: { notIn: busy.map((b) => b.seatId).concat(-1) } }, orderBy: [{ coachId: 'asc' }, { seatNumber: 'asc' }], take: n + 6, select: { id: true } });
      if (candidates.length < n) throw conflict(`Only ${candidates.length} seat(s) available in this class`);
      const ids = candidates.map((c) => c.id).sort((a, b) => a - b);
      await tx.$queryRaw`SELECT id FROM coach_seats WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
      const stillBusy = await tx.seatReservation.findMany({ where: { seatId: { in: ids }, journeyDate: runDate, active: 1, segmentSeq: { in: segs } }, select: { seatId: true }, distinct: ['seatId'] });
      const bad = new Set(stillBusy.map((b) => b.seatId)); const free = candidates.map((c) => c.id).filter((id) => !bad.has(id));
      if (free.length >= n) return free.slice(0, n);
    }
    throw conflict('High demand - please try again');
  },
  async get(id: number, actor: Actor) {
    await releaseExpiredHolds(); const b = await bookingRepo.byId(id); if (!b) throw notFound('Booking');
    if (b.userId !== actor.id && !actor.canReadAll) throw forbidden('This booking belongs to another user'); // resource-level authorization / ownership
    return b;
  },
  async byPnr(pnr: string, actor: Actor) { const r = await bookingRepo.byPnr(pnr); if (!r) throw notFound('PNR'); if (r.booking.userId !== actor.id && !actor.canReadAll) throw forbidden('This booking belongs to another user'); return r.booking; },
  async list(actor: Actor, q: { page: number; size: number; q?: string; sort?: string; dir: 'asc' | 'desc'; status?: string; scope?: string; userId?: number }) {
    await releaseExpiredHolds();
    const where: Prisma.BookingWhereInput = { ...(actor.canReadAll ? (q.userId ? { userId: q.userId } : {}) : { userId: actor.id }), ...(q.status ? { status: q.status as never } : {}), ...(q.scope === 'upcoming' ? { departureAt: { gt: new Date() }, status: { in: ['CONFIRMED', 'PARTIALLY_CANCELLED', 'PENDING_PAYMENT'] } } : q.scope === 'past' ? { departureAt: { lte: new Date() } } : {}), ...(q.q ? { OR: [{ pnr: { pnr: { contains: q.q } } }, { train: { name: { contains: q.q } } }, { train: { number: { contains: q.q } } }, { passengers: { some: { name: { contains: q.q } } } }] } : {}) };
    const sortable = ['createdAt', 'departureAt', 'totalAmount', 'status']; const [items, total] = await bookingRepo.list(where, q.page * q.size, q.size, { [sortable.includes(q.sort ?? '') ? q.sort! : 'createdAt']: q.sort ? q.dir : 'desc' });
    return { items, total };
  },
  /** Cancellation rules are DATA (cancellation_rules table, editable by admins): the highest `minHoursBefore` threshold not exceeding the hours left applies. */
  async quote(id: number, actor: Actor, passengerIds?: number[]) {
    const b = await this.get(id, actor); const live = b.passengers.filter((p) => p.status === 'CONFIRMED');
    const chosen = passengerIds?.length ? live.filter((p) => passengerIds.includes(p.id)) : live;
    if (passengerIds?.length && chosen.length !== passengerIds.length) throw badRequest('Some selected passengers are not active on this booking');
    const hoursBefore = Math.floor((b.departureAt.getTime() - Date.now()) / 3_600_000); const rules = await bookingRepo.rules();
    const rule = rules.find((r) => r.minHoursBefore <= Math.max(hoursBefore, 0)) ?? rules[rules.length - 1];
    const gross = chosen.reduce((s, p) => s + Number(p.fare), 0); const pct = Number(rule.chargePercent); const charge = Math.round(gross * pct) / 100; const round = (n: number) => Math.round(n * 100) / 100;
    return { booking: b, passengers: chosen, hoursBefore, rule: { label: rule.label, chargePercent: pct }, grossFare: round(gross), chargeAmount: round(charge), refundAmount: round(gross - charge) };
  },
  /** Scenario 5: ownership + status validation, charge calculation, passenger/seat release, cancellation record, refund - all in one transaction. */
  async cancel(id: number, actor: Actor, d: { passengerIds?: number[]; reason?: string }) {
    const b = await this.get(id, actor);
    if (b.userId !== actor.id && !actor.canCancelAny) throw forbidden('You cannot cancel another user\'s booking');
    if (!['CONFIRMED', 'PARTIALLY_CANCELLED'].includes(b.status)) throw badRequest(`A ${b.status.replace('_', ' ').toLowerCase()} booking cannot be cancelled`);
    if (b.departureAt <= new Date()) throw badRequest('The train has already departed');
    const q = await this.quote(id, actor, d.passengerIds); if (!q.passengers.length) throw badRequest('No active passengers to cancel');
    const payment = b.payments.find((p) => p.status === 'SUCCEEDED' || p.status === 'PARTIALLY_REFUNDED');
    const result = await prisma.$transaction(async (tx) => {
      const fresh = await tx.booking.findUniqueOrThrow({ where: { id }, include: { passengers: true } });
      if (!['CONFIRMED', 'PARTIALLY_CANCELLED'].includes(fresh.status)) throw conflict('This booking was just changed');
      const ids = q.passengers.map((p) => p.id);
      const claimed = await tx.bookingPassenger.updateMany({ where: { id: { in: ids }, status: 'CONFIRMED' }, data: { status: 'CANCELLED' } }); // atomic claim: a double click cancels once
      if (claimed.count !== ids.length) throw conflict('Some passengers were already cancelled');
      await tx.seatReservation.updateMany({ where: { bookingSeat: { bookingPassengerId: { in: ids } }, active: 1 }, data: { active: null } }); // frees every segment of the seat
      await tx.bookingSeat.updateMany({ where: { bookingPassengerId: { in: ids } }, data: { status: 'RELEASED' } });
      const remaining = await tx.bookingPassenger.count({ where: { bookingId: id, status: 'CONFIRMED' }});
      await tx.booking.update({ where: { id }, data: { status: remaining === 0 ? 'CANCELLED' : 'PARTIALLY_CANCELLED' } });
      const rec = await tx.cancellationRecord.create({ data: { bookingId: id, cancelledById: actor.id, passengerIds: ids, hoursBefore: q.hoursBefore, chargePercent: q.rule.chargePercent, grossFare: q.grossFare, chargeAmount: q.chargeAmount, refundAmount: q.refundAmount, reason: d.reason ?? null } });
      let refund = null;
      if (payment && q.refundAmount > 0) {
        // simulation provider: the refund is "sent" immediately; a real gateway would leave it PENDING until its webhook arrives
        refund = await tx.refund.create({ data: { paymentId: payment.id, bookingId: id, cancellationId: rec.id, amount: q.refundAmount, status: 'PROCESSED', reference: reference('RFD'), processedAt: new Date() } });
        const refunded = Number((await tx.refund.aggregate({ where: { paymentId: payment.id, status: 'PROCESSED' }, _sum: { amount: true } }))._sum.amount ?? 0);
        await tx.payment.update({ where: { id: payment.id }, data: { status: refunded >= Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
      }
      return { rec, refund };
    });
    const pnr = b.pnr?.pnr ?? '';
    await notify(b.userId, { type: 'CANCELLATION', title: `Cancellation confirmed - PNR ${pnr}`, message: `${q.passengers.length} passenger(s) cancelled. Charges ₹${q.chargeAmount} (${q.rule.chargePercent}%), refund ₹${q.refundAmount}.`, link: `/bookings/${id}` });
    if (result.refund) await notify(b.userId, { type: 'REFUND', title: 'Refund processed', message: `₹${q.refundAmount} refunded to your original payment method (ref ${result.refund.reference}).`, link: `/bookings/${id}` });
    return { ...(await this.get(id, actor)), cancellationSummary: { chargeAmount: q.chargeAmount, refundAmount: q.refundAmount, grossFare: q.grossFare, rule: q.rule, hoursBefore: q.hoursBefore } };
  },
  cancellations: async (q: { page: number; size: number }) => { const [items, total] = await bookingRepo.cancellations(q.page * q.size, q.size); return { items, total }; },
  async rules() { return bookingRepo.rules(); },
  async setRules(rules: { minHoursBefore: number; chargePercent: number; label: string }[]) { await prisma.$transaction([prisma.cancellationRule.deleteMany(), prisma.cancellationRule.createMany({ data: rules })]); return bookingRepo.rules(); },
  ACTIVE,
};
