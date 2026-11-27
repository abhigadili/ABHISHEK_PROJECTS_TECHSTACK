import { prisma, Prisma } from '../database/prisma';
export const stationRepo = {
  list: (where: Prisma.StationWhereInput, skip: number, take: number, orderBy: Prisma.StationOrderByWithRelationInput) => Promise.all([prisma.station.findMany({ where, orderBy, skip, take, include: { _count: { select: { routeStops: true } } } }), prisma.station.count({ where })]),
  byId: (id: number) => prisma.station.findUnique({ where: { id }, include: { routeStops: { include: { route: { include: { train: { select: { id: true, number: true, name: true } } } } } } } }),
  byCode: (code: string) => prisma.station.findUnique({ where: { code } }),
  create: (data: Prisma.StationCreateInput) => prisma.station.create({ data }),
  update: (id: number, data: Prisma.StationUpdateInput) => prisma.station.update({ where: { id }, data }),
  stopCount: (id: number) => prisma.trainRouteStation.count({ where: { stationId: id } }),
  bookingCount: (id: number) => prisma.booking.count({ where: { OR: [{ fromStationId: id }, { toStationId: id }] } }),
  remove: (id: number) => prisma.station.delete({ where: { id } }),
};
