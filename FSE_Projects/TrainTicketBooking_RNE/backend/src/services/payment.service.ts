import { prisma, Prisma } from '../database/prisma';
import { env } from '../config/env';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors';
import { generatePnr, reference } from '../utils/crypto';
import { releaseExpiredHolds } from './availability.service';
import { notify } from './notification.service';
import type { Actor } from './booking.service';

const payInclude = { booking: { include: { pnr: true, train: { select: { number: true, name: true } }, fromStation: true, toStation: true, passengers: true, user: { select: { id: true, name: true, email: true } } } }, refunds: true } satisfies Prisma.PaymentInclude;

async function ownPayment(id: number, actor: Actor) {
  const p = await prisma.payment.findUnique({ where: { id }, include: payInclude }); if (!p) throw notFound('Payment');
  if (p.booking.userId !== actor.id && !actor.canReadAll) throw forbidden('This payment belongs to another user');
  return p;
}
/** Payment Management with a configurable provider. Only PAYMENT_PROVIDER=simulation is implemented (no card data is ever received or stored). */
export const paymentService = {
  /** Step 1: create an INITIATED payment for a booking that is still holding its seats. */
  async initiate(actor: Actor, d: { bookingId: number; method: string; cardLast4?: string }) {
    if (env.PAYMENT_PROVIDER !== 'simulation') throw badRequest(`Payment provider "${env.PAYMENT_PROVIDER}" is not implemented - set PAYMENT_PROVIDER=simulation`);
    await releaseExpiredHolds();
    const b = await prisma.booking.findUnique({ where: { id: d.bookingId } }); if (!b) throw notFound('Booking');
    if (b.userId !== actor.id) throw forbidden('You can only pay for your own bookings');
    if (b.status === 'EXPIRED') throw badRequest('The seat hold expired - please search and book again');
    if (b.status !== 'PENDING_PAYMENT') throw badRequest('This booking is not awaiting payment');
    const open = await prisma.payment.findFirst({ where: { bookingId: b.id, status: 'INITIATED' } });
    if (open) return ownPayment(open.id, actor); // idempotent: reuse the open payment
    const p = await prisma.payment.create({ data: { bookingId: b.id, amount: b.totalAmount, method: d.method, provider: 'simulation', reference: reference('PAY'), cardLast4: d.method === 'CARD' ? d.cardLast4 : null } });
    return ownPayment(p.id, actor);
  },
  /**
   * Step 2: confirm. Simulation: the caller chooses SUCCESS/FAILURE (a card ending 0002 always fails). SUCCESS atomically marks the payment
   * paid, confirms booking + seats and issues the PNR; FAILURE keeps the hold (retry until it expires).
   */
  async confirm(id: number, actor: Actor, outcome: 'SUCCESS' | 'FAILURE') {
    let p = await ownPayment(id, actor); if (p.booking.userId !== actor.id) throw forbidden();
    if (p.status === 'SUCCEEDED') return p; // idempotent
    if (p.status !== 'INITIATED') throw badRequest(`Payment is already ${p.status.toLowerCase()}`);
    await releaseExpiredHolds();
    if ((await prisma.booking.findUniqueOrThrow({ where: { id: p.bookingId } })).status !== 'PENDING_PAYMENT') throw conflict('The booking is no longer awaiting payment (the seat hold may have expired)');
    const fails = outcome === 'FAILURE' || p.cardLast4 === '0002';
    if (fails) {
      await prisma.payment.update({ where: { id }, data: { status: 'FAILED', failureReason: p.cardLast4 === '0002' ? 'Card declined by the simulated gateway' : 'Payment cancelled/failed' } });
      await notify(p.booking.userId, { type: 'PAYMENT_FAILED', title: 'Payment failed', message: `Payment ${p.reference} for booking #${p.bookingId} failed. Your seats are held until the timer ends - you can retry.`, link: `/bookings/${p.bookingId}/payment` });
      return ownPayment(id, actor);
    }
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({ where: { id, status: 'INITIATED' }, data: { status: 'SUCCEEDED', confirmedAt: new Date() } });
      if (claimed.count !== 1) throw conflict('Payment was already processed');
      const b = await tx.booking.updateMany({ where: { id: p.bookingId, status: 'PENDING_PAYMENT' }, data: { status: 'CONFIRMED', expiresAt: null } });
      if (b.count !== 1) throw conflict('The booking expired before the payment completed');
      await tx.bookingSeat.updateMany({ where: { bookingPassenger: { bookingId: p.bookingId } }, data: { status: 'CONFIRMED' } });
      for (let i = 0; i < 5; i++) { try { await tx.pnrRecord.create({ data: { pnr: generatePnr(), bookingId: p.bookingId } }); break; } catch (e) { if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') || i === 4) throw e; } }
    });
    p = await ownPayment(id, actor); const pnr = p.booking.pnr?.pnr ?? '';
    await notify(p.booking.userId, { type: 'BOOKING_CONFIRMED', title: `Booking confirmed - PNR ${pnr}`, message: `${p.booking.train.number} ${p.booking.train.name}, ${p.booking.fromStation.code} → ${p.booking.toStation.code}. ${p.booking.passengers.length} passenger(s).`, link: `/bookings/${p.bookingId}` });
    await notify(p.booking.userId, { type: 'PAYMENT_CONFIRMED', title: 'Payment received', message: `₹${p.amount} received. Transaction reference ${p.reference}.`, link: `/bookings/${p.bookingId}` });
    return p;
  },
  get: (id: number, actor: Actor) => ownPayment(id, actor),
  async list(actor: Actor, q: { page: number; size: number; status?: string; q?: string }) {
    const where: Prisma.PaymentWhereInput = { ...(actor.canReadAll ? {} : { booking: { userId: actor.id } }), ...(q.status ? { status: q.status as never } : {}), ...(q.q ? { OR: [{ reference: { contains: q.q } }, { booking: { pnr: { pnr: { contains: q.q } } } }] } : {}) };
    const [items, total] = await Promise.all([prisma.payment.findMany({ where, include: payInclude, orderBy: { createdAt: 'desc' }, skip: q.page * q.size, take: q.size }), prisma.payment.count({ where })]);
    return { items, total };
  },
  /** Receipt (invoice) data for a successful payment - rendered/printed by the frontend. */
  async receipt(id: number, actor: Actor) {
    const p = await ownPayment(id, actor); if (!['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(p.status)) throw badRequest('A receipt is available only for successful payments');
    return { receiptNo: `RCT-${p.reference.slice(4)}`, issuedAt: p.confirmedAt, payment: { reference: p.reference, method: p.method, cardLast4: p.cardLast4, amount: p.amount, status: p.status }, booking: { id: p.booking.id, pnr: p.booking.pnr?.pnr, train: p.booking.train, from: p.booking.fromStation, to: p.booking.toStation, departureAt: p.booking.departureAt, passengers: p.booking.passengers.map((x) => ({ name: x.name, age: x.age, gender: x.gender, fare: x.fare, status: x.status })) }, customer: p.booking.user, refunds: p.refunds };
  },
};
export const refundService = {
  async list(actor: Actor, q: { page: number; size: number }) {
    const where: Prisma.RefundWhereInput = actor.canReadAll ? {} : { booking: { userId: actor.id } };
    const [items, total] = await Promise.all([prisma.refund.findMany({ where, include: { booking: { include: { pnr: true, train: { select: { number: true, name: true } } } }, payment: { select: { reference: true, method: true } }, cancellation: true }, orderBy: { createdAt: 'desc' }, skip: q.page * q.size, take: q.size }), prisma.refund.count({ where })]);
    return { items, total };
  },
  async get(id: number, actor: Actor) {
    const r = await prisma.refund.findUnique({ where: { id }, include: { booking: { include: { pnr: true, train: { select: { number: true, name: true } } } }, payment: true, cancellation: true } }); if (!r) throw notFound('Refund');
    if (r.booking.userId !== actor.id && !actor.canReadAll) throw forbidden(); return r;
  },
};
