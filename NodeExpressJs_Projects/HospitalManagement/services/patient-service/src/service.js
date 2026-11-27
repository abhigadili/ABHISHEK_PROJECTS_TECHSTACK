import { stageEvent } from '@hms/shared/kafka';
import { ConflictError, ForbiddenError, NotFoundError, dateOnly, hasRole, isAdmin, pageOf, parseDate } from '@hms/shared/utils';

const toDto = (p) => ({
  id: p.id, userId: p.userId, firstName: p.firstName, lastName: p.lastName, dateOfBirth: dateOnly(p.dateOfBirth), gender: p.gender, email: p.email, phone: p.phone,
  identityNumber: p.identityNumber, bloodGroup: p.bloodGroup, address: p.address, emergencyContactName: p.emergencyContactName, emergencyContactPhone: p.emergencyContactPhone,
  knownAllergies: p.knownAllergies, status: p.status, createdAt: p.createdAt, updatedAt: p.updatedAt,
});
const toSummary = (p) => ({ id: p.id, userId: p.userId, fullName: `${p.firstName} ${p.lastName}`, email: p.email, phone: p.phone, status: p.status });

export function createPatientService({ prisma, cache, config, logger }) {
  const ttl = config.cache.patientSec;
  const PK = (id) => `patient:${id}`;
  const SK = (id) => `summary:${id}`;
  const data = (b) => ({
    firstName: b.firstName, lastName: b.lastName, dateOfBirth: parseDate(b.dateOfBirth), gender: b.gender, email: b.email.toLowerCase(), phone: b.phone,
    identityNumber: b.identityNumber?.trim() || null, bloodGroup: b.bloodGroup ?? null, address: b.address ?? null, emergencyContactName: b.emergencyContactName ?? null,
    emergencyContactPhone: b.emergencyContactPhone ?? null, knownAllergies: b.knownAllergies ?? null,
  });
  const assertOwnerOrStaff = (ownerUserId, user) => {
    if (hasRole(user, 'PATIENT') && !isAdmin(user) && ownerUserId !== user.id) throw new ForbiddenError('Patients may only access their own profile');
  };

  /** Scenario 1: validate -> reject duplicates -> store + stage PatientRegistered in the SAME transaction (outbox). */
  async function register(b, user) {
    const userId = hasRole(user, 'PATIENT') && !isAdmin(user) ? user.id : b.userId ?? null;
    const d = data(b);
    if (userId && await prisma.patient.findUnique({ where: { userId } })) throw new ConflictError('A patient profile already exists for this login');
    if (await prisma.patient.findUnique({ where: { email: d.email } })) throw new ConflictError(`A patient with email '${d.email}' is already registered`);
    if (await prisma.patient.findUnique({ where: { phone: d.phone } })) throw new ConflictError(`A patient with phone '${d.phone}' is already registered`);
    if (d.identityNumber && await prisma.patient.findUnique({ where: { identityNumber: d.identityNumber } })) throw new ConflictError(`A patient with identity number '${d.identityNumber}' is already registered`);
    const p = await prisma.$transaction(async (tx) => {
      const created = await tx.patient.create({ data: { ...d, userId } });
      await stageEvent(tx, 'PatientRegistered', created.id, { patientId: created.id, userId: created.userId, firstName: created.firstName, lastName: created.lastName, email: created.email, phone: created.phone });
      return created;
    });
    logger.info({ patientId: p.id }, 'Patient registered');
    return toDto(p);
  }

  async function get(id, user) {
    const dto = await cache.getOrSet(PK(id), ttl, async () => { const p = await prisma.patient.findUnique({ where: { id } }); return p ? toDto(p) : null; });
    if (!dto) throw new NotFoundError(`Patient ${id} not found`);
    assertOwnerOrStaff(dto.userId, user);
    return dto;
  }
  async function summary(id) {
    const s = await cache.getOrSet(SK(id), ttl, async () => { const p = await prisma.patient.findUnique({ where: { id } }); return p ? toSummary(p) : null; });
    if (!s) throw new NotFoundError(`Patient ${id} not found`);
    return s;
  }
  async function summaryByUser(userId) {
    const p = await prisma.patient.findUnique({ where: { userId } });
    if (!p) throw new NotFoundError(`No patient profile for user ${userId}`);
    return toSummary(p);
  }
  async function profileByUser(userId, user) {
    const p = await prisma.patient.findUnique({ where: { userId } });
    if (!p) throw new NotFoundError(`No patient profile for user ${userId}`);
    assertOwnerOrStaff(p.userId, user);
    return toDto(p);
  }
  async function search({ q, page, size }) {
    const where = q?.trim() ? { OR: ['firstName', 'lastName', 'email', 'phone'].map((f) => ({ [f]: { contains: q.trim() } })) } : {};
    const [rows, total] = await Promise.all([
      prisma.patient.findMany({ where, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], skip: page * size, take: size }),
      prisma.patient.count({ where }),
    ]);
    return pageOf(rows.map(toDto), page, size, total);
  }
  async function update(id, b, user) {
    const p = await prisma.patient.findUnique({ where: { id } });
    if (!p) throw new NotFoundError(`Patient ${id} not found`);
    assertOwnerOrStaff(p.userId, user);
    const d = data(b);
    if (p.email !== d.email && await prisma.patient.findUnique({ where: { email: d.email } })) throw new ConflictError(`Email '${d.email}' belongs to another patient`);
    if (p.phone !== d.phone && await prisma.patient.findUnique({ where: { phone: d.phone } })) throw new ConflictError(`Phone '${d.phone}' belongs to another patient`);
    if (d.identityNumber && p.identityNumber !== d.identityNumber && await prisma.patient.findUnique({ where: { identityNumber: d.identityNumber } })) throw new ConflictError('Identity number belongs to another patient');
    const updated = await prisma.patient.update({ where: { id }, data: d });
    await cache.del(PK(id), SK(id));                    // invalidate after the commit
    return toDto(updated);
  }
  async function deactivate(id) {
    await prisma.patient.update({ where: { id }, data: { status: 'INACTIVE' } }).catch(() => { throw new NotFoundError(`Patient ${id} not found`); });
    await cache.del(PK(id), SK(id));
  }
  return { register, get, summary, summaryByUser, profileByUser, search, update, deactivate };
}
