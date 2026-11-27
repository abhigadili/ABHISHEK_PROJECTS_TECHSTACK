import { randomUUID } from 'node:crypto';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, ServiceUnavailableError, dateOnly, hasRole, isAdmin, pageOf, parseDate, toNum, todayStr } from '@hms/shared/utils';
import { DAYS } from './schemas.js';

const toDto = (d) => ({
  id: d.id, userId: d.userId, fullName: `Dr. ${d.firstName} ${d.lastName}`, firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone, licenseNumber: d.licenseNumber,
  specialization: d.specialization, qualification: d.qualification, experienceYears: d.experienceYears, consultationFee: toNum(d.consultationFee), hospitalId: d.hospitalId,
  departmentId: d.departmentId, active: d.active,
});
const toScheduleEntry = (s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, slotMinutes: s.slotMinutes, breakStart: s.breakStart, breakEnd: s.breakEnd });
const mins = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const dayName = (dateStr) => DAYS[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];

export function createDoctorService({ prisma, cache, config, logger, hospitals }) {
  const doctorTtl = config.cache.doctorSec;
  const slotTtl = config.cache.slotsSec;
  const DK = (id) => `doctor:${id}`;
  const VK = (id) => `slots-version:${id}`;

  async function create(b) {
    const email = b.email.toLowerCase();
    if (await prisma.doctor.findUnique({ where: { licenseNumber: b.licenseNumber } })) throw new ConflictError(`License number '${b.licenseNumber}' is already registered`);
    if (await prisma.doctor.findUnique({ where: { email } })) throw new ConflictError(`Email '${email}' is already registered`);
    if (b.userId && await prisma.doctor.findUnique({ where: { userId: b.userId } })) throw new ConflictError('This login already belongs to another doctor');
    await hospitals.validate(b.hospitalId, b.departmentId);       // gRPC + circuit breaker
    const d = await prisma.doctor.create({ data: { ...b, email } });
    logger.info({ doctorId: d.id }, 'Doctor created');
    return toDto(d);
  }

  const get = async (id) => (await cache.getOrSet(DK(id), doctorTtl, async () => { const d = await prisma.doctor.findUnique({ where: { id } }); return d ? toDto(d) : null; }))
    ?? (() => { throw new NotFoundError(`Doctor ${id} not found`); })();

  async function update(id, b) {
    const d = await prisma.doctor.findUnique({ where: { id } });
    if (!d) throw new NotFoundError(`Doctor ${id} not found`);
    const email = b.email.toLowerCase();
    if (d.licenseNumber !== b.licenseNumber && await prisma.doctor.findUnique({ where: { licenseNumber: b.licenseNumber } })) throw new ConflictError('License number already registered');
    if (d.email !== email && await prisma.doctor.findUnique({ where: { email } })) throw new ConflictError('Email already registered');
    if (b.userId && b.userId !== d.userId && await prisma.doctor.findUnique({ where: { userId: b.userId } })) throw new ConflictError('This login already belongs to another doctor');
    await hospitals.validate(b.hospitalId, b.departmentId);
    const dto = toDto(await prisma.doctor.update({ where: { id }, data: { ...b, email, userId: b.userId ?? d.userId } }));
    await cache.set(DK(id), dto, doctorTtl);              // cache update (write-through)
    return dto;
  }
  async function deactivate(id) {
    await prisma.doctor.update({ where: { id }, data: { active: false } }).catch(() => { throw new NotFoundError(`Doctor ${id} not found`); });
    await cache.del(DK(id));
    await bumpVersion(id);
  }
  async function search(q) {
    const where = { active: q.active ? q.active === 'true' : true, ...(q.specialization ? { specialization: { equals: q.specialization.trim() } } : {}),
      ...(q.hospitalId ? { hospitalId: q.hospitalId } : {}), ...(q.departmentId ? { departmentId: q.departmentId } : {}) };
    const [rows, total] = await Promise.all([prisma.doctor.findMany({ where, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], skip: q.page * q.size, take: q.size }), prisma.doctor.count({ where })]);
    return pageOf(rows.map(toDto), q.page, q.size, total);
  }
  const specializations = async () => (await prisma.doctor.findMany({ where: { active: true }, distinct: ['specialization'], select: { specialization: true }, orderBy: { specialization: 'asc' } })).map((r) => r.specialization);

  // ---------- availability / slots
  const version = (id) => cache.getOrSet(VK(id), 86400, async () => randomUUID()).then((v) => v ?? randomUUID());
  const bumpVersion = (id) => cache.set(VK(id), randomUUID(), 86400);       // O(1) invalidation of every cached grid of the doctor

  async function buildSlots(doctorId, date) {
    const d = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!d || !d.active) return [];
    if (await prisma.doctorUnavailability.findUnique({ where: { doctorId_unavailableDate: { doctorId, unavailableDate: parseDate(date) } } })) return [];
    const s = await prisma.doctorSchedule.findUnique({ where: { doctorId_dayOfWeek: { doctorId, dayOfWeek: dayName(date) } } });
    if (!s) return [];
    const slots = [];
    for (let start = mins(s.startTime); start + s.slotMinutes <= mins(s.endTime); start += s.slotMinutes) {
      const end = start + s.slotMinutes;
      const inBreak = s.breakStart && s.breakEnd && start < mins(s.breakEnd) && end > mins(s.breakStart);
      if (!inBreak) slots.push({ startTime: hhmm(start), endTime: hhmm(end), available: true });
    }
    return slots;
  }
  async function slots(doctorId, date) {
    if (!await prisma.doctor.findUnique({ where: { id: doctorId }, select: { id: true } })) throw new NotFoundError(`Doctor ${doctorId} not found`);
    const v = await version(doctorId);
    return cache.getOrSet(`slots:${doctorId}:${v}:${date}`, slotTtl, () => buildSlots(doctorId, date));
  }
  async function availableOn(date, specialization) {
    const dow = dayName(date);
    const docs = await prisma.doctor.findMany({
      where: { active: true, schedules: { some: { dayOfWeek: dow } }, unavailability: { none: { unavailableDate: parseDate(date) } }, ...(specialization ? { specialization: { equals: specialization.trim() } } : {}) },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const out = [];
    for (const d of docs) {
      const sl = await slots(d.id, date);
      if (sl.length) out.push({ doctor: toDto(d), slotCount: sl.length, firstSlot: sl[0].startTime, lastSlotEnd: sl.at(-1).endTime });
    }
    return out;
  }

  // ---------- schedule management (Scenario 3)
  async function assertCanManage(id, user) {
    const d = await prisma.doctor.findUnique({ where: { id } });
    if (!d) throw new NotFoundError(`Doctor ${id} not found`);
    if (isAdmin(user)) return d;
    if (hasRole(user, 'DOCTOR') && d.userId && d.userId === user.id) return d;
    throw new ForbiddenError('Only an administrator or the doctor concerned can change this availability');
  }
  const schedule = async (id) => {
    await get(id);
    return (await prisma.doctorSchedule.findMany({ where: { doctorId: id } })).sort((a, b) => DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek)).map(toScheduleEntry);
  };
  async function replaceSchedule(id, { days }, user) {
    await assertCanManage(id, user);
    const seen = new Set();
    for (const e of days) {
      if (seen.has(e.dayOfWeek)) throw new BadRequestError(`Duplicate entry for ${e.dayOfWeek}`);
      seen.add(e.dayOfWeek);
      if (mins(e.startTime) >= mins(e.endTime)) throw new BadRequestError(`${e.dayOfWeek}: startTime must be before endTime`);
      if (Boolean(e.breakStart) !== Boolean(e.breakEnd)) throw new BadRequestError(`${e.dayOfWeek}: breakStart and breakEnd must be given together`);
      if (e.breakStart && (mins(e.breakStart) >= mins(e.breakEnd) || mins(e.breakStart) < mins(e.startTime) || mins(e.breakEnd) > mins(e.endTime))) throw new BadRequestError(`${e.dayOfWeek}: break must lie inside working hours and start before it ends`);
      if (mins(e.endTime) - mins(e.startTime) < e.slotMinutes) throw new BadRequestError(`${e.dayOfWeek}: working hours are shorter than one slot`);
    }
    await prisma.$transaction([prisma.doctorSchedule.deleteMany({ where: { doctorId: id } }), prisma.doctorSchedule.createMany({ data: days.map((e) => ({ doctorId: id, ...e, breakStart: e.breakStart ?? null, breakEnd: e.breakEnd ?? null })) })]);
    await bumpVersion(id);
    logger.info({ doctorId: id, days: days.length }, 'Doctor schedule replaced');
    return schedule(id);
  }
  async function unavailability(id) {
    await get(id);
    return (await prisma.doctorUnavailability.findMany({ where: { doctorId: id, unavailableDate: { gte: parseDate(todayStr()) } }, orderBy: { unavailableDate: 'asc' } }))
      .map((u) => ({ id: u.id, date: dateOnly(u.unavailableDate), reason: u.reason }));
  }
  async function addUnavailability(id, { date, reason }, user) {
    await assertCanManage(id, user);
    if (date < todayStr()) throw new BadRequestError('Cannot mark a past date as unavailable');
    if (await prisma.doctorUnavailability.findUnique({ where: { doctorId_unavailableDate: { doctorId: id, unavailableDate: parseDate(date) } } })) throw new ConflictError(`Date ${date} is already marked unavailable`);
    const u = await prisma.doctorUnavailability.create({ data: { doctorId: id, unavailableDate: parseDate(date), reason: reason ?? null } });
    await bumpVersion(id);
    return { id: u.id, date, reason: u.reason };
  }
  async function removeUnavailability(id, uid, user) {
    await assertCanManage(id, user);
    const u = await prisma.doctorUnavailability.findFirst({ where: { id: uid, doctorId: id } });
    if (!u) throw new NotFoundError(`Unavailability ${uid} not found`);
    await prisma.doctorUnavailability.delete({ where: { id: uid } });
    await bumpVersion(id);
  }
  return { create, get, update, deactivate, search, specializations, slots, availableOn, schedule, replaceSchedule, unavailability, addUnavailability, removeUnavailability };
}

/** gRPC client of the Hospital Service: a hospital/department reference must never be stored unverified, so failures end in 503. */
export function createHospitalDirectory({ createGrpcClient, loadProto, config, logger }) {
  const pkg = loadProto('hospital.proto').hms.hospitals;
  const client = createGrpcClient({ name: 'hospital-service', Service: pkg.HospitalService, address: config.services.grpc.hospital, logger });
  return {
    async validate(hospitalId, departmentId) {
      let h;
      try { h = await client.getHospital({ hospitalId }); } catch (e) { if (e instanceof NotFoundError) throw new BadRequestError(`Hospital ${hospitalId} does not exist`); throw e; }
      if (!h.active) throw new BadRequestError(`Hospital ${hospitalId} is not active`);
      if (!departmentId) return;
      let d;
      try { d = await client.getDepartment({ departmentId }); } catch (e) { if (e instanceof NotFoundError) throw new BadRequestError(`Department ${departmentId} does not exist`); throw e; }
      if (!d.active || d.hospitalId !== hospitalId) throw new BadRequestError(`Department ${departmentId} is not an active department of hospital ${hospitalId}`);
    },
  };
}
export { ServiceUnavailableError };
