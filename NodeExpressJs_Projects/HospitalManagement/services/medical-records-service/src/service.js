import { ConflictError, NotFoundError, pageOf } from '@hms/shared/utils';
import { ENTRY_TYPES } from './schemas.js';

const toDto = (e) => ({ id: e.id, patientId: e.patientId, entryType: e.entryType, title: e.title, details: e.details, doctorId: e.doctorId, referenceType: e.referenceType, referenceId: e.referenceId, source: e.source, recordedAt: e.recordedAt });

export function createRecordService({ prisma, logger, patients }) {
  const ensureRecord = async (db, patientId, name) =>
    (await db.patientRecord.findUnique({ where: { patientId } })) ?? db.patientRecord.create({ data: { patientId, patientName: name } });

  async function addEntry(b) {
    const p = await patients.get(b.patientId);
    const rec = await ensureRecord(prisma, p.id, p.fullName);
    return toDto(await prisma.recordEntry.create({ data: { recordId: rec.id, patientId: p.id, entryType: b.entryType, title: b.title, details: b.details ?? null, doctorId: b.doctorId ?? null } }));
  }
  async function updateEntry(id, b) {
    const e = await prisma.recordEntry.findUnique({ where: { id } });
    if (!e) throw new NotFoundError(`Entry ${id} not found`);
    if (e.source !== 'MANUAL') throw new ConflictError('System-generated entries cannot be edited');
    return toDto(await prisma.recordEntry.update({ where: { id }, data: { title: b.title, details: b.details ?? null } }));
  }
  async function updateConditions(patientId, conditions) {
    const p = await patients.get(patientId);
    const rec = await ensureRecord(prisma, p.id, p.fullName);
    await prisma.patientRecord.update({ where: { id: rec.id }, data: { chronicConditions: conditions ?? null } });
  }
  async function timeline(patientId, { type, page, size }, user) {
    await patients.requireAccess(patientId, user);                 // staff, or the patient themself
    const where = { patientId, ...(type ? { entryType: type } : {}) };
    const [rows, total] = await Promise.all([prisma.recordEntry.findMany({ where, orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }], skip: page * size, take: size }), prisma.recordEntry.count({ where })]);
    return pageOf(rows.map(toDto), page, size, total);
  }
  async function entry(id, user) {
    const e = await prisma.recordEntry.findUnique({ where: { id } });
    if (!e) throw new NotFoundError(`Entry ${id} not found`);
    await patients.requireAccess(e.patientId, user);
    return toDto(e);
  }
  async function summary(patientId, user) {
    await patients.requireAccess(patientId, user);
    const rec = await prisma.patientRecord.findUnique({ where: { patientId } });
    if (!rec) throw new NotFoundError(`No medical record exists yet for patient ${patientId}`);
    const grouped = await prisma.recordEntry.groupBy({ by: ['entryType'], where: { patientId }, _count: { _all: true } });
    const counts = Object.fromEntries(ENTRY_TYPES.map((t) => [t, 0]));
    for (const g of grouped) counts[g.entryType] = g._count._all;
    const latest = await prisma.recordEntry.findMany({ where: { patientId }, orderBy: { recordedAt: 'desc' }, take: 5 });
    return { patientId, patientName: rec.patientName, chronicConditions: rec.chronicConditions, entryCounts: counts, latestEntries: latest.map(toDto) };
  }

  // ---- event-driven writes (run inside the consumer's transaction `tx`)
  const initRecord = (tx, patientId, name) => ensureRecord(tx, patientId, name);
  /** One system entry per (type, source reference): redelivered events never duplicate the timeline. */
  async function addSystemEntry(tx, { patientId, patientName, entryType, title, details, doctorId, referenceType, referenceId }) {
    if (await tx.recordEntry.findFirst({ where: { entryType, referenceType, referenceId } })) return;
    const rec = await ensureRecord(tx, patientId, patientName ?? `Patient ${patientId}`);
    await tx.recordEntry.create({ data: { recordId: rec.id, patientId, entryType, title, details: details ?? null, doctorId: doctorId ?? null, referenceType, referenceId, source: 'EVENT' } });
    logger.info({ patientId, entryType, referenceType, referenceId }, 'Timeline entry added');
  }
  return { addEntry, updateEntry, updateConditions, timeline, entry, summary, initRecord, addSystemEntry };
}
