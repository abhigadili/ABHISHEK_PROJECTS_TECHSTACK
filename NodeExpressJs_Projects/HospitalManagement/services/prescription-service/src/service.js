import { stageEvent } from '@hms/shared/kafka';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, dateOnly, hasRole, isAdmin, parseDate, todayStr } from '@hms/shared/utils';

const toDto = (p) => ({
  id: p.id, patientId: p.patientId, patientName: p.patientName, doctorId: p.doctorId, doctorName: p.doctorName, appointmentId: p.appointmentId, diagnosis: p.diagnosis, notes: p.notes,
  status: p.status, validUntil: dateOnly(p.validUntil), issuedAt: p.issuedAt,
  items: (p.items ?? []).map((i) => ({ id: i.id, medicineName: i.medicineName, dosage: i.dosage, frequency: i.frequency, durationDays: i.durationDays, quantity: i.quantity, instructions: i.instructions })),
});

export function createPrescriptionService({ prisma, logger, config, patients, doctors }) {
  const find = async (id) => (await prisma.prescription.findUnique({ where: { id }, include: { items: true } })) ?? (() => { throw new NotFoundError(`Prescription ${id} not found`); })();

  async function create(b, user) {
    const patient = await patients.get(b.patientId);                      // gRPC
    if (patient.status !== 'ACTIVE') throw new BadRequestError(`Patient ${patient.id} is not active`);
    const doctor = await doctors.get(b.doctorId);                         // gRPC
    if (!doctor.active) throw new BadRequestError(`Doctor ${doctor.id} is not active`);
    if (!isAdmin(user) && (!doctor.userId || doctor.userId !== user.id)) throw new ForbiddenError('A doctor can only issue prescriptions in their own name');
    const valid = new Date(); valid.setDate(valid.getDate() + (b.validDays ?? config.jobs.prescriptionValidityDays));
    const validUntil = `${valid.getFullYear()}-${String(valid.getMonth() + 1).padStart(2, '0')}-${String(valid.getDate()).padStart(2, '0')}`;
    const p = await prisma.$transaction(async (tx) => {
      const created = await tx.prescription.create({
        data: { patientId: patient.id, patientName: patient.fullName, patientEmail: patient.email, doctorId: doctor.id, doctorName: doctor.fullName, appointmentId: b.appointmentId ?? null,
          diagnosis: b.diagnosis ?? null, notes: b.notes ?? null, validUntil: parseDate(validUntil), items: { create: b.items.map((i) => ({ ...i, medicineName: i.medicineName.trim(), instructions: i.instructions ?? null })) } },
        include: { items: true },
      });
      await stageEvent(tx, 'PrescriptionCreated', created.id, { prescriptionId: created.id, patientId: created.patientId, patientName: created.patientName, patientEmail: created.patientEmail,
        doctorId: created.doctorId, doctorName: created.doctorName, validUntil, diagnosis: created.diagnosis,
        items: created.items.map((i) => ({ medicineName: i.medicineName, dosage: i.dosage, frequency: i.frequency, durationDays: i.durationDays, quantity: i.quantity })) });
      return created;
    });
    logger.info({ prescriptionId: p.id, patientId: p.patientId, doctorId: p.doctorId }, 'Prescription created');
    return toDto(p);
  }
  async function get(id, user) {
    const p = await find(id);
    if (hasRole(user, 'PATIENT')) await patients.requireAccess(p.patientId, user);
    return toDto(p);
  }
  async function status(id, user) {
    const p = await prisma.prescription.findUnique({ where: { id } });
    if (!p) throw new NotFoundError(`Prescription ${id} not found`);
    if (hasRole(user, 'PATIENT')) await patients.requireAccess(p.patientId, user);
    return { id: p.id, status: p.status, statusChangedAt: p.statusChangedAt };
  }
  async function forPatient(patientId, user) {
    await patients.requireAccess(patientId, user);
    return (await prisma.prescription.findMany({ where: { patientId }, include: { items: true }, orderBy: { issuedAt: 'desc' } })).map(toDto);
  }
  const forDoctor = async (doctorId) => (await prisma.prescription.findMany({ where: { doctorId }, include: { items: true }, orderBy: { issuedAt: 'desc' } })).map(toDto);
  async function cancel(id, user) {
    const p = await find(id);
    if (!isAdmin(user)) { const d = await doctors.get(p.doctorId); if (!d.userId || d.userId !== user.id) throw new ForbiddenError('Only the prescribing doctor can cancel this prescription'); }
    if (p.status !== 'ACTIVE') throw new ConflictError(`Only ACTIVE prescriptions can be cancelled (current: ${p.status})`);
    const u = await prisma.prescription.update({ where: { id }, data: { status: 'CANCELLED', statusChangedAt: new Date() } });
    return { id: u.id, status: u.status, statusChangedAt: u.statusChangedAt };
  }
  /** Consumer of MedicineDispensed (Pharmacy) - runs inside the consumer's transaction. */
  async function markDispensed(tx, prescriptionId) {
    const p = await tx.prescription.findUnique({ where: { id: prescriptionId } });
    if (!p) { logger.warn({ prescriptionId }, 'MedicineDispensed for unknown prescription'); return; }
    if (p.status === 'ACTIVE') await tx.prescription.update({ where: { id: prescriptionId }, data: { status: 'DISPENSED', statusChangedAt: new Date() } });
  }
  async function expireOverdue() {
    const r = await prisma.prescription.updateMany({ where: { status: 'ACTIVE', validUntil: { lt: parseDate(todayStr()) } }, data: { status: 'EXPIRED', statusChangedAt: new Date() } });
    if (r.count) logger.info({ count: r.count }, 'Prescription expiry job: prescription(s) expired');
  }
  return { create, get, status, forPatient, forDoctor, cancel, markDispensed, expireOverdue };
}
