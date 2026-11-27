import bcrypt from 'bcrypt';
import { SignJWT } from 'jose';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ROLES } from '@hms/shared/constants';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '@hms/shared/utils';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const ttlSeconds = (ttl) => { const m = /^(\d+)([smhd])$/.exec(ttl); return Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[m[2]]; };

export const toUser = (u) => ({ id: u.id, username: u.username, email: u.email, role: u.role, enabled: u.enabled });   // never exposes the hash
const toHospital = (h) => ({ id: h.id, name: h.name, code: h.code, address: h.address, city: h.city, phone: h.phone, email: h.email, active: h.active });
const toDept = (d) => ({ id: d.id, hospitalId: d.hospitalId, name: d.name, description: d.description, active: d.active });

/** Identity (users, passwords, JWT access + rotating refresh tokens) and hospital / department master data. */
export function createHospitalService({ prisma, cache, config, logger }) {
  const key = new TextEncoder().encode(config.jwt.secret);
  const hospitalTtl = config.cache.hospitalSec;
  const HKEY = (id) => `hospital:${id}`;
  const DKEY = (id) => `departments:${id}`;

  // ---------------------------------------------------------------- tokens
  async function signAccess(user) {
    return new SignJWT({ preferred_username: user.username, email: user.email, roles: [user.role] })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject(String(user.id)).setIssuer(config.jwt.issuer).setAudience(config.jwt.audience)
      .setIssuedAt().setJti(randomUUID()).setExpirationTime(config.jwt.accessTtl).sign(key);
  }
  async function issueTokens(user, familyId = randomUUID(), tx = prisma) {
    const refreshToken = randomBytes(48).toString('base64url');
    await tx.refreshToken.create({ data: { userId: user.id, tokenHash: sha256(refreshToken), familyId, expiresAt: new Date(Date.now() + config.jwt.refreshTtlDays * 86400000) } });
    return { accessToken: await signAccess(user), refreshToken, tokenType: 'Bearer', expiresInSeconds: ttlSeconds(config.jwt.accessTtl), user: toUser(user) };
  }

  // ---------------------------------------------------------------- auth
  async function login({ username, password }) {
    const u = await prisma.user.findUnique({ where: { username } });
    const locked = u?.lockedUntil && u.lockedUntil > new Date();
    // identical answer for unknown user / wrong password / disabled / locked: no user enumeration
    if (!u || !u.enabled || locked || !(await bcrypt.compare(password, u.passwordHash))) {
      if (u && u.enabled && !locked) {
        const attempts = u.failedAttempts + 1;
        await prisma.user.update({ where: { id: u.id }, data: attempts >= 8 ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + 5 * 60000) } : { failedAttempts: attempts } });
      }
      logger.warn({ username }, 'Failed login attempt');
      throw new UnauthorizedError('Invalid username or password');
    }
    await prisma.user.update({ where: { id: u.id }, data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } });
    logger.info({ username: u.username, role: u.role }, 'User logged in');
    return issueTokens(u);
  }

  /** Refresh-token rotation: each token is single-use; presenting an already-used token revokes the whole family (theft detection). */
  async function refresh({ refreshToken }) {
    const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) }, include: { user: true } });
    if (!row) throw new UnauthorizedError('Invalid refresh token');
    if (row.revokedAt) {
      await prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      logger.warn({ userId: row.userId }, 'Refresh token reuse detected: token family revoked');
      throw new UnauthorizedError('Invalid refresh token');
    }
    if (row.expiresAt < new Date() || !row.user.enabled) throw new UnauthorizedError('Refresh token expired');
    return prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
      return issueTokens(row.user, row.familyId, tx);
    });
  }

  async function logout({ refreshToken }) {
    const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (row) await prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async function createUser({ username, email, password, role }) {
    if (await prisma.user.findUnique({ where: { username } })) throw new ConflictError(`Username '${username}' is already taken`);
    if (await prisma.user.findUnique({ where: { email: email.toLowerCase() } })) throw new ConflictError(`Email '${email}' is already registered`);
    const u = await prisma.user.create({ data: { username, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 10), role } });
    logger.info({ username, role }, 'User created');
    return toUser(u);
  }
  const registerPatientAccount = (b) => createUser({ ...b, role: ROLES.PATIENT });

  const me = async (user) => toUser(await prisma.user.findUnique({ where: { id: user.id } }) ?? (() => { throw new NotFoundError('User not found'); })());
  const listUsers = async () => (await prisma.user.findMany({ orderBy: { id: 'asc' } })).map(toUser);
  async function setEnabled(id, enabled, actor) {
    if (!enabled && id === actor.id) throw new BadRequestError('You cannot disable your own account');
    const u = await prisma.user.update({ where: { id }, data: { enabled } }).catch(() => { throw new NotFoundError(`User ${id} not found`); });
    if (!enabled) await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    return toUser(u);
  }

  // ---------------------------------------------------------------- hospitals / departments (Redis cached)
  async function createHospital(b) {
    if (await prisma.hospital.findUnique({ where: { code: b.code } })) throw new ConflictError(`Hospital code '${b.code}' already exists`);
    return toHospital(await prisma.hospital.create({ data: b }));
  }
  const listHospitals = async () => (await prisma.hospital.findMany({ orderBy: { name: 'asc' } })).map(toHospital);
  const getHospital = (id) => cache.getOrSet(HKEY(id), hospitalTtl, async () => {
    const h = await prisma.hospital.findUnique({ where: { id } });
    return h ? toHospital(h) : null;
  }).then((h) => h ?? (() => { throw new NotFoundError(`Hospital ${id} not found`); })());
  async function updateHospital(id, b) {
    const h = await prisma.hospital.findUnique({ where: { id } });
    if (!h) throw new NotFoundError(`Hospital ${id} not found`);
    if (h.code !== b.code && await prisma.hospital.findUnique({ where: { code: b.code } })) throw new ConflictError(`Hospital code '${b.code}' already exists`);
    const dto = toHospital(await prisma.hospital.update({ where: { id }, data: b }));
    await cache.set(HKEY(id), dto, hospitalTtl);          // write-through
    return dto;
  }
  async function deactivateHospital(id) {
    await prisma.hospital.update({ where: { id }, data: { active: false } }).catch(() => { throw new NotFoundError(`Hospital ${id} not found`); });
    await cache.del(HKEY(id));
  }
  async function listDepartments(hospitalId) {
    await getHospital(hospitalId);
    return cache.getOrSet(DKEY(hospitalId), hospitalTtl, async () => (await prisma.department.findMany({ where: { hospitalId }, orderBy: { name: 'asc' } })).map(toDept));
  }
  async function addDepartment(hospitalId, b) {
    if (!await prisma.hospital.findUnique({ where: { id: hospitalId } })) throw new NotFoundError(`Hospital ${hospitalId} not found`);
    if (await prisma.department.findUnique({ where: { hospitalId_name: { hospitalId, name: b.name } } })) throw new ConflictError(`Department '${b.name}' already exists in this hospital`);
    const d = await prisma.department.create({ data: { hospitalId, ...b } });
    await cache.del(DKEY(hospitalId));
    return toDept(d);
  }
  const getDepartment = async (id) => toDept(await prisma.department.findUnique({ where: { id } }) ?? (() => { throw new NotFoundError(`Department ${id} not found`); })());
  async function updateDepartment(id, b) {
    const d = await prisma.department.update({ where: { id }, data: b }).catch(() => { throw new NotFoundError(`Department ${id} not found`); });
    await cache.del(DKEY(d.hospitalId));
    return toDept(d);
  }
  async function deactivateDepartment(id) {
    const d = await prisma.department.update({ where: { id }, data: { active: false } }).catch(() => { throw new NotFoundError(`Department ${id} not found`); });
    await cache.del(DKEY(d.hospitalId));
  }

  // ---------------------------------------------------------------- first-run seed
  async function seed() {
    const mk = async (username, role, password) => {
      if (await prisma.user.findUnique({ where: { username } })) return;
      await prisma.user.create({ data: { username, email: `${username}@hospital.local`, passwordHash: await bcrypt.hash(password, 10), role } });
      logger.info({ username, role }, 'Seeded user');
    };
    await mk('admin', ROLES.ADMIN, config.seed.adminPassword);
    for (const [u, r] of [['doctor1', ROLES.DOCTOR], ['doctor2', ROLES.DOCTOR], ['labstaff1', ROLES.LAB_STAFF], ['pharmacist1', ROLES.PHARMACIST], ['billing1', ROLES.BILLING_STAFF]]) await mk(u, r, config.seed.staffPassword);
    if (!await prisma.hospital.findUnique({ where: { code: 'CGH' } })) {
      await prisma.hospital.create({ data: { name: 'City General Hospital', code: 'CGH', city: 'Hyderabad', address: '1 Health Avenue', phone: '+91-40-5550100', email: 'info@cgh.hospital.local',
        departments: { create: ['Cardiology', 'General Medicine', 'Pediatrics', 'Orthopedics', 'Laboratory', 'Pharmacy'].map((name) => ({ name })) } } });
      logger.info('Seeded default hospital CGH with 6 departments');
    }
  }

  return { login, refresh, logout, createUser, registerPatientAccount, me, listUsers, setEnabled, createHospital, listHospitals, getHospital, updateHospital, deactivateHospital,
    listDepartments, addDepartment, getDepartment, updateDepartment, deactivateDepartment, seed };
}
