import { stageEvent } from '@hms/shared/kafka';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, at, dateOnly, hasRole, isAdmin, parseDate, toNum, todayStr } from '@hms/shared/utils';

const toDto = (a) => ({
  id: a.id, patientId: a.patientId, patientName: a.patientName, doctorId: a.doctorId, doctorName: a.doctorName, date: dateOnly(a.appointmentDate), startTime: a.startTime, endTime: a.endTime,
  status: a.status, reason: a.reason, cancelReason: a.cancelReason, notes: a.notes, fee: toNum(a.fee), paymentStatus: a.paymentStatus, billNumber: a.billNumber, createdAt: a.createdAt,
});
const slotKey = (doctorId, date, start) => `${doctorId}|${date}|${start}`;
const startsAt = (a) => at(dateOnly(a.appointmentDate), a.startTime);
const endsAt = (a) => at(dateOnly(a.appointmentDate), a.endTime);

export function createAppointmentService({ prisma, cache, config, logger, patients, doctors }) {
  const AV = (doctorId, date) => `availability:${doctorId}:${date}`;
  const AP = (id) => `appointment:${id}`;

  // ---- availability (Scenario 2 + 3): doctor grid (HTTP + Opossum) minus booked / elapsed slots. Cached briefly, evicted on every change.
  // Booking NEVER reads this cache: it re-reads the live grid and re-checks the database (source of truth).
  const availability = (doctorId, date) => cache.getOrSet(AV(doctorId, date), config.cache.availabilitySec, async () => {
    const grid = await doctors.slots(doctorId, date);
    const booked = await prisma.appointment.findMany({ where: { doctorId, appointmentDate: parseDate(date), status: 'BOOKED' } });
    const now = new Date();
    return grid.map((s) => ({ ...s, available: !booked.some((a) => a.startTime < s.endTime && a.endTime > s.startTime) && at(date, s.startTime) >= now }));
  });

  async function resolveSlot(doctorId, date, start) {
    if (at(date, start) < new Date()) throw new BadRequestError('Cannot book a time in the past');
    const grid = await doctors.slots(doctorId, date);          // always the live grid
    const slot = grid.find((s) => s.startTime === start);
    if (!slot) throw new BadRequestError(`The doctor does not offer a slot starting at ${start} on ${date} (not a working day/hour, on a break, or on leave)`);
    return slot;
  }
  async function assertFree(doctorId, patientId, date, slot, excludeId) {
    const base = { appointmentDate: parseDate(date), status: 'BOOKED', startTime: { lt: slot.endTime }, endTime: { gt: slot.startTime }, ...(excludeId ? { id: { not: excludeId } } : {}) };
    if (await prisma.appointment.findFirst({ where: { doctorId, ...base } })) throw new ConflictError(`The doctor already has an appointment overlapping ${slot.startTime}-${slot.endTime} on ${date}`);
    if (await prisma.appointment.findFirst({ where: { patientId, ...base } })) throw new ConflictError(`The patient already has an overlapping appointment on ${date}`);
  }
  async function authorizeParticipant(a, user) {
    if (isAdmin(user)) return;
    if (hasRole(user, 'PATIENT')) { await patients.requireAccess(a.patientId, user); return; }
    if (hasRole(user, 'DOCTOR')) { const d = await doctors.get(a.doctorId); if (d.userId && d.userId === user.id) return; }
    throw new ForbiddenError('You are not a participant of this appointment');
  }
  const find = async (id) => (await prisma.appointment.findUnique({ where: { id } })) ?? (() => { throw new NotFoundError(`Appointment ${id} not found`); })();

  // ---- booking
  async function book(b, user) {
    const patient = await patients.requireAccess(b.patientId, user);                   // gRPC
    if (patient.status !== 'ACTIVE') throw new BadRequestError(`Patient ${patient.id} is not active`);
    const doctor = await doctors.get(b.doctorId);                                      // gRPC
    if (!doctor.active) throw new BadRequestError(`Doctor ${doctor.id} is not accepting appointments`);
    const slot = await resolveSlot(doctor.id, b.date, b.startTime);                    // HTTP
    await assertFree(doctor.id, patient.id, b.date, slot);
    let a;
    try {
      a = await prisma.$transaction(async (tx) => {
        const created = await tx.appointment.create({ data: {
          patientId: patient.id, patientName: patient.fullName, patientEmail: patient.email, doctorId: doctor.id, doctorName: doctor.fullName, doctorEmail: doctor.email, fee: doctor.consultationFee,
          appointmentDate: parseDate(b.date), startTime: slot.startTime, endTime: slot.endTime, reason: b.reason ?? null, slotKey: slotKey(doctor.id, b.date, slot.startTime),   // unique: the loser of a race fails here
        } });
        await stageEvent(tx, 'AppointmentBooked', created.id, { appointmentId: created.id, patientId: created.patientId, patientName: created.patientName, patientEmail: created.patientEmail,
          doctorId: created.doctorId, doctorName: created.doctorName, doctorEmail: created.doctorEmail, date: b.date, startTime: created.startTime, endTime: created.endTime, fee: toNum(created.fee) });
        return created;
      });
    } catch (e) { if (e.code === 'P2002') throw new ConflictError('This slot has just been booked by someone else'); throw e; }
    await cache.del(AV(a.doctorId, b.date));                                           // evict AFTER commit
    logger.info({ appointmentId: a.id, doctorId: a.doctorId, patientId: a.patientId, date: b.date, start: a.startTime }, 'Appointment booked');
    return toDto(a);
  }

  async function reschedule(id, b, user) {
    const a = await find(id);
    await authorizeParticipant(a, user);
    if (a.status !== 'BOOKED') throw new ConflictError(`Only BOOKED appointments can be rescheduled (current: ${a.status})`);
    const slot = await resolveSlot(a.doctorId, b.date, b.startTime);
    await assertFree(a.doctorId, a.patientId, b.date, slot, a.id);
    const oldDate = dateOnly(a.appointmentDate); const oldStart = a.startTime;
    let u;
    try {
      u = await prisma.$transaction(async (tx) => {
        const upd = await tx.appointment.update({ where: { id }, data: { appointmentDate: parseDate(b.date), startTime: slot.startTime, endTime: slot.endTime, slotKey: slotKey(a.doctorId, b.date, slot.startTime), reminderSent: false } });
        await stageEvent(tx, 'AppointmentRescheduled', id, { appointmentId: id, patientId: a.patientId, patientName: a.patientName, patientEmail: a.patientEmail, doctorId: a.doctorId, doctorName: a.doctorName,
          doctorEmail: a.doctorEmail, oldDate, oldStartTime: oldStart, newDate: b.date, newStartTime: slot.startTime, newEndTime: slot.endTime });
        return upd;
      });
    } catch (e) { if (e.code === 'P2002') throw new ConflictError('The requested slot has just been booked by someone else'); throw e; }
    await cache.del(AV(a.doctorId, oldDate), AV(a.doctorId, b.date), AP(id));
    return toDto(u);
  }

  async function cancel(id, reason, user) {
    const a = await find(id);
    await authorizeParticipant(a, user);
    if (a.status !== 'BOOKED') throw new ConflictError(`Only BOOKED appointments can be cancelled (current: ${a.status})`);
    if (startsAt(a) < new Date()) throw new BadRequestError('The appointment time has already passed');
    const date = dateOnly(a.appointmentDate);
    const u = await prisma.$transaction(async (tx) => {
      const upd = await tx.appointment.update({ where: { id }, data: { status: 'CANCELLED', slotKey: null, cancelReason: reason ?? null } });   // NULL frees the slot
      await stageEvent(tx, 'AppointmentCancelled', id, { appointmentId: id, patientId: a.patientId, patientName: a.patientName, patientEmail: a.patientEmail, doctorId: a.doctorId, doctorName: a.doctorName,
        doctorEmail: a.doctorEmail, date, startTime: a.startTime, cancelledBy: user?.username ?? 'system', reason: reason ?? null });
      return upd;
    });
    await cache.del(AV(a.doctorId, date), AP(id));
    logger.info({ appointmentId: id, by: user?.username }, 'Appointment cancelled');
    return toDto(u);
  }

  async function complete(id, notes, user) {
    const a = await find(id);
    if (!isAdmin(user)) { const d = await doctors.get(a.doctorId); if (!d.userId || d.userId !== user.id) throw new ForbiddenError('Only the treating doctor can complete this appointment'); }
    if (a.status !== 'BOOKED') throw new ConflictError(`Only BOOKED appointments can be completed (current: ${a.status})`);
    if (startsAt(a) > new Date()) throw new BadRequestError('The appointment has not started yet');
    const u = await prisma.$transaction(async (tx) => {
      const upd = await tx.appointment.update({ where: { id }, data: { status: 'COMPLETED', notes: notes ?? null } });
      await stageEvent(tx, 'AppointmentCompleted', id, { appointmentId: id, patientId: a.patientId, doctorId: a.doctorId, doctorName: a.doctorName, date: dateOnly(a.appointmentDate), notes: notes ?? null });
      return upd;
    });
    await cache.del(AP(id));
    return toDto(u);
  }

  // ---- reads
  async function get(id, user) {
    const a = await cache.getOrSet(AP(id), config.cache.appointmentSec, async () => { const r = await prisma.appointment.findUnique({ where: { id } }); return r ? toDto(r) : null; });
    if (!a) throw new NotFoundError(`Appointment ${id} not found`);
    if (hasRole(user, 'PATIENT') && !isAdmin(user)) await patients.requireAccess(a.patientId, user);
    return a;
  }
  async function forPatient(patientId, user) {
    await patients.requireAccess(patientId, user);
    return (await prisma.appointment.findMany({ where: { patientId }, orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }] })).map(toDto);
  }
  const mine = async (user) => forPatient((await patients.getByUser(user.id)).id, user);
  const forDoctor = async (doctorId, date) => (await prisma.appointment.findMany({ where: { doctorId, ...(date ? { appointmentDate: parseDate(date) } : {}) }, orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }] })).map(toDto);

  // ---- called by Kafka consumers (inside the consumer's transaction)
  async function applyBilling(tx, appointmentId, billNumber, status) {
    const a = await tx.appointment.findUnique({ where: { id: appointmentId } });
    if (!a) { logger.warn({ appointmentId }, 'Billing event for unknown appointment'); return; }
    await tx.appointment.update({ where: { id: appointmentId }, data: { billNumber, ...(a.paymentStatus === 'PAID' ? {} : { paymentStatus: status }) } });
    await cache.del(AP(appointmentId));
  }

  // ---- scheduled jobs
  async function sendReminders() {
    const now = new Date();
    const limit = new Date(now.getTime() + config.jobs.reminderLeadHours * 3600000);
    const day = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const rows = await prisma.appointment.findMany({ where: { status: 'BOOKED', reminderSent: false, appointmentDate: { gte: parseDate(day(now)), lte: parseDate(day(limit)) } } });
    let sent = 0;
    for (const a of rows.filter((r) => startsAt(r) >= now && startsAt(r) <= limit)) {
      const when = `${dateOnly(a.appointmentDate)} ${a.startTime}`;
      await prisma.$transaction(async (tx) => {
        if (a.patientEmail) await stageEvent(tx, 'NotificationRequested', `appt-reminder-${a.id}`, { recipientEmail: a.patientEmail, channel: 'EMAIL', subject: 'Appointment reminder', message: `Reminder: you have an appointment with ${a.doctorName} on ${when}.`, eventType: 'APPOINTMENT_REMINDER', referenceId: String(a.id) });
        if (a.doctorEmail) await stageEvent(tx, 'NotificationRequested', `appt-reminder-${a.id}`, { recipientEmail: a.doctorEmail, channel: 'EMAIL', subject: 'Upcoming appointment', message: `Reminder: appointment with patient ${a.patientName} on ${when}.`, eventType: 'APPOINTMENT_REMINDER', referenceId: String(a.id) });
        await tx.appointment.update({ where: { id: a.id }, data: { reminderSent: true } });
      });
      sent += 1;
    }
    if (sent) logger.info({ count: sent }, 'Appointment reminder job: reminder(s) queued');
  }
  async function markMissed() {
    const cutoff = new Date(Date.now() - 2 * 3600000);
    const rows = (await prisma.appointment.findMany({ where: { status: 'BOOKED', appointmentDate: { lte: parseDate(todayStr()) } } })).filter((a) => endsAt(a) < cutoff);
    for (const a of rows) {
      await prisma.appointment.update({ where: { id: a.id }, data: { status: 'MISSED', slotKey: null } });
      await cache.del(AP(a.id), AV(a.doctorId, dateOnly(a.appointmentDate)));
    }
    if (rows.length) logger.info({ count: rows.length }, 'Missed-appointment job: appointment(s) marked MISSED');
  }
  return { availability, book, reschedule, cancel, complete, get, forPatient, mine, forDoctor, applyBilling, sendReminders, markMissed };
}
