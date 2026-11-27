import { prisma } from '../database/prisma';
import { todayDateOnly } from '../utils/dates';
/** Dashboard aggregations (counts, revenue, refunds, bookings by status / per day). */
export const statsService = {
  async dashboard() {
    const today = new Date(); today.setHours(0, 0, 0, 0); const since = new Date(Date.now() - 14 * 86_400_000);
    const [users, trains, stations, byStatus, revenue, refunds, todayBookings, perDay, topTrains, cancels] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }), prisma.train.count(), prisma.station.count(),
      prisma.booking.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.payment.aggregate({ where: { status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.refund.aggregate({ where: { status: 'PROCESSED' }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.booking.count({ where: { createdAt: { gte: today } } }),
      prisma.$queryRaw<{ d: string; n: bigint }[]>`SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') AS d, COUNT(*) AS n FROM bookings WHERE createdAt >= ${since} GROUP BY d ORDER BY d`,
      prisma.booking.groupBy({ by: ['trainId'], where: { status: { in: ['CONFIRMED', 'PARTIALLY_CANCELLED'] } }, _count: { _all: true }, orderBy: { _count: { trainId: 'desc' } }, take: 5 }),
      prisma.cancellationRecord.aggregate({ _sum: { chargeAmount: true }, _count: { _all: true } }),
    ]);
    const trainRows = await prisma.train.findMany({ where: { id: { in: topTrains.map((t) => t.trainId) } }, select: { id: true, number: true, name: true } });
    const gross = Number(revenue._sum.amount ?? 0), refunded = Number(refunds._sum.amount ?? 0);
    return { users, trains, stations, todayBookings, bookingsByStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })), payments: { count: revenue._count._all, gross, refunded, net: gross - refunded, refundCount: refunds._count._all }, cancellations: { count: cancels._count._all, charges: Number(cancels._sum.chargeAmount ?? 0) }, perDay: perDay.map((r) => ({ date: r.d, count: Number(r.n) })), topTrains: topTrains.map((t) => ({ ...(trainRows.find((r) => r.id === t.trainId) ?? { id: t.trainId, number: '', name: '' }), bookings: t._count._all })), asOf: todayDateOnly() };
  },
};
