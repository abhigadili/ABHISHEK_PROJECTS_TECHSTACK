import { prisma } from '../database/prisma';
import { forbidden, notFound } from '../utils/errors';
interface PassengerInput { name: string; age: number; gender: 'MALE' | 'FEMALE' | 'OTHER'; mobile?: string; idType?: string; idNumber?: string }
/** Saved-passenger address book. Only the LAST FOUR characters of an ID number are kept (data minimisation). */
const data = (d: PassengerInput) => ({ name: d.name, age: d.age, gender: d.gender, mobile: d.mobile || null, idType: d.idType || null, idLast4: d.idNumber ? d.idNumber.slice(-4) : null });
async function owned(id: number, userId: number, canAll: boolean) { const p = await prisma.passenger.findFirst({ where: { id, deletedAt: null } }); if (!p) throw notFound('Passenger'); if (p.userId !== userId && !canAll) throw forbidden(); return p; }
export const passengerService = {
  async list(userId: number, canAll: boolean, q: { page: number; size: number; q?: string; userId?: number }) {
    const where = { deletedAt: null, ...(canAll && q.userId ? { userId: q.userId } : canAll ? {} : { userId }), ...(q.q ? { name: { contains: q.q } } : {}) };
    const [items, total] = await Promise.all([prisma.passenger.findMany({ where, orderBy: { name: 'asc' }, skip: q.page * q.size, take: q.size }), prisma.passenger.count({ where })]); return { items, total };
  },
  get: (id: number, userId: number, canAll: boolean) => owned(id, userId, canAll),
  create: (userId: number, d: PassengerInput) => prisma.passenger.create({ data: { userId, ...data(d) } }),
  async update(id: number, userId: number, canAll: boolean, d: PassengerInput) { await owned(id, userId, canAll); return prisma.passenger.update({ where: { id }, data: data(d) }); },
  async remove(id: number, userId: number, canAll: boolean) { await owned(id, userId, canAll); await prisma.passenger.update({ where: { id }, data: { deletedAt: new Date() } }); },
  /** Passenger history: bookings in which a saved passenger travelled. */
  async history(id: number, userId: number, canAll: boolean) { await owned(id, userId, canAll); return prisma.bookingPassenger.findMany({ where: { passengerId: id }, include: { booking: { include: { pnr: true, train: { select: { number: true, name: true } }, fromStation: true, toStation: true } }, seat: { include: { seat: { include: { coach: { select: { number: true } }, seatType: true } } } } }, orderBy: { id: 'desc' }, take: 50 }); },
};
