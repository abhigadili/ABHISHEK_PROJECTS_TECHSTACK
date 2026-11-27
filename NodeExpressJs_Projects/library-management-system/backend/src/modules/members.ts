import { Router } from 'express';
import { z } from 'zod';
import { exec, query, queryOne, withTx } from '../lib/db';
import { audit } from '../lib/audit';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { idParam, ok, optDate, page, pagination, parse, wrap } from '../lib/http';
import { upload, validateImage } from '../lib/images';
import { getMemberPolicy, startMembership } from '../lib/membership';
import { hashPassword, passwordSchema, randomToken } from '../lib/password';
import { notify } from '../lib/notify';
import { requireAuth, requireRole, staffOnly } from '../middleware/auth';
import { applyProfileUpdate, profileUpdateSchema } from './profile';
import { memberFields, publicUser } from './auth';
import { assertSelfOrStaff } from '../lib/access';
import { getSettings } from '../lib/settings';

export const membersRouter = Router();
membersRouter.use(requireAuth);

const MEMBER_SELECT = `
  SELECT u.id, u.email, u.full_name AS fullName, u.phone, u.status, u.status_reason AS statusReason,
         u.created_at AS createdAt, u.last_login_at AS lastLoginAt,
         mp.member_code AS memberCode, mp.registration_date AS registrationDate, mp.city, mp.country,
         t.name AS membershipType, m.end_date AS membershipEnd, m.status AS membershipStatus,
         (SELECT COUNT(*) FROM loans l WHERE l.user_id = u.id AND l.status = 'active') AS activeLoans,
         (SELECT COALESCE(SUM(f.amount - f.waived_amount - f.paid_amount), 0) FROM fines f WHERE f.user_id = u.id) AS outstandingFines,
         (SELECT COUNT(*) FROM user_images ui WHERE ui.user_id = u.id) > 0 AS hasPicture
    FROM users u
    JOIN member_profiles mp ON mp.user_id = u.id
    LEFT JOIN memberships m ON m.id = (SELECT m2.id FROM memberships m2 WHERE m2.user_id = u.id AND m2.status <> 'cancelled'
                                        ORDER BY m2.end_date DESC, m2.id DESC LIMIT 1)
    LEFT JOIN member_types t ON t.id = m.member_type_id`;

membersRouter.get('/', staffOnly, wrap(async (req, res) => {
  const p = pagination(req.query);
  const where: string[] = []; const args: any[] = [];
  const q = String(req.query.q ?? '').trim();
  if (q) {
    where.push('(u.full_name LIKE ? OR u.email LIKE ? OR mp.member_code LIKE ? OR u.phone LIKE ?)');
    const like = `%${q.replace(/[%_]/g, '\\$&')}%`; args.push(like, like, like, like);
  }
  if (req.query.status) { where.push('u.status = ?'); args.push(String(req.query.status)); }
  if (req.query.typeId) { where.push('m.member_type_id = ?'); args.push(Number(req.query.typeId)); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await queryOne<any>(`SELECT COUNT(*) AS n FROM (${MEMBER_SELECT} ${w}) x`, args))!.n;
  const rows = await query(`${MEMBER_SELECT} ${w} ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`, [...args, p.pageSize, p.offset]);
  page(res, rows.map((r: any) => ({ ...r, hasPicture: !!r.hasPicture })), p, total);
}));

// Staff registers a member (optionally with a picture). A temporary password is generated if none is given.
const staffCreateSchema = memberFields.extend({
  password: z.preprocess((v) => (v === '' ? undefined : v), passwordSchema.optional()),
  memberTypeId: z.coerce.number().int().positive(),
});

membersRouter.post('/', staffOnly, upload.single('picture'), wrap(async (req, res) => {
  const b = parse(staffCreateSchema, req.body);
  const image = validateImage(req.file);
  const type = await queryOne('SELECT id FROM member_types WHERE id = ? AND is_active = 1', [b.memberTypeId]);
  if (!type) throw badRequest('Membership type not available', { memberTypeId: 'Not available' });
  if (await queryOne('SELECT id FROM users WHERE email = ?', [b.email])) throw conflict('Email already registered', { email: 'Already registered' });
  const tempPassword = b.password ? null : `${randomToken(6)}A1`;
  const hash = await hashPassword(b.password ?? tempPassword!);
  const id = await withTx(async (c) => {
    const r = await exec(`INSERT INTO users (email, password_hash, full_name, phone, role_id, status) VALUES (?,?,?,?,3,'active')`,
      [b.email, hash, b.fullName, b.phone], c);
    const uid = r.insertId;
    await exec(`INSERT INTO member_profiles (user_id, member_code, date_of_birth, gender, address, city, state, postal_code, country, registration_date)
                VALUES (?,?,?,?,?,?,?,?,?,CURDATE())`,
      [uid, `LM${new Date().getUTCFullYear()}${String(uid).padStart(6, '0')}`, b.dateOfBirth, b.gender ?? null, b.address, b.city, b.state, b.postalCode, b.country], c);
    await startMembership(c, uid, b.memberTypeId, req.user!.id, 'Registered by staff');
    if (image) await exec('INSERT INTO user_images (user_id, mime_type, size_bytes, sha256, data) VALUES (?,?,?,?,?)',
      [uid, image.mime, image.size, image.sha, image.data], c);
    await notify(uid, 'welcome', 'Welcome to the library', 'Your membership has been created by library staff.', '/member/dashboard', c);
    return uid;
  });
  await audit(req, req.user!.id, 'member.create', 'user', id);
  ok(res, { member: await publicUser(id), temporaryPassword: tempPassword }, 201);
}));

membersRouter.get('/:id', wrap(async (req, res) => {
  const id = idParam(req);
  assertSelfOrStaff(req.user!, id);
  const row = await queryOne<any>(`${MEMBER_SELECT} WHERE u.id = ?`, [id]);
  if (!row) throw notFound('Member');
  const profile = await queryOne('SELECT date_of_birth AS dateOfBirth, gender, address, state, postal_code AS postalCode FROM member_profiles WHERE user_id = ?', [id]);
  ok(res, { ...row, ...profile, hasPicture: !!row.hasPicture, policy: await getMemberPolicy(id) });
}));

membersRouter.patch('/:id', staffOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (!(await queryOne('SELECT 1 FROM member_profiles WHERE user_id = ?', [id]))) throw notFound('Member');
  const b = parse(profileUpdateSchema.extend({ email: z.string().trim().toLowerCase().pipe(z.email()).optional() }), req.body);
  if (b.email) {
    const dup = await queryOne('SELECT id FROM users WHERE email = ? AND id <> ?', [b.email, id]);
    if (dup) throw conflict('Email already registered', { email: 'Already registered' });
    await exec('UPDATE users SET email = ? WHERE id = ?', [b.email, id]);
  }
  await applyProfileUpdate(id, b);
  await audit(req, req.user!.id, 'member.update', 'user', id);
  ok(res, await publicUser(id));
}));

// Activate / suspend / deactivate.
membersRouter.post('/:id/status', staffOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const b = parse(z.object({ status: z.enum(['active', 'suspended', 'inactive']), reason: z.string().trim().max(255).optional() }), req.body);
  const target = await queryOne<any>('SELECT u.id, u.status FROM users u WHERE u.id = ? AND u.role_id = 3', [id]);
  if (!target) throw notFound('Member');
  if ((b.status === 'suspended' || b.status === 'inactive') && !b.reason) throw badRequest('A reason is required', { reason: 'Required' });
  await withTx(async (c) => {
    await exec('UPDATE users SET status = ?, status_reason = ? WHERE id = ?', [b.status, b.status === 'active' ? null : b.reason ?? null, id], c);
    await exec(`UPDATE memberships SET status = ? WHERE user_id = ? AND status IN ('active','suspended') AND end_date >= CURDATE()`,
      [b.status === 'active' ? 'active' : 'suspended', id], c);
    if (b.status !== 'active') await exec('DELETE FROM sessions WHERE user_id = ?', [id], c);
    await notify(id, 'account_status', 'Account status changed',
      b.status === 'active' ? 'Your account is active.' : `Your account is now ${b.status}${b.reason ? `: ${b.reason}` : ''}.`, '/member/dashboard', c);
  });
  await audit(req, req.user!.id, `member.${b.status}`, 'user', id, { from: target.status, reason: b.reason ?? null });
  ok(res, await publicUser(id));
}));

// Renew the current term or switch membership type (starts a new term; history is kept).
membersRouter.post('/:id/membership', staffOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const b = parse(z.object({ memberTypeId: z.coerce.number().int().positive(), notes: z.string().trim().max(255).optional() }), req.body);
  if (!(await queryOne('SELECT 1 FROM users WHERE id = ? AND role_id = 3', [id]))) throw notFound('Member');
  if (!(await queryOne('SELECT 1 FROM member_types WHERE id = ? AND is_active = 1', [b.memberTypeId]))) throw badRequest('Membership type not available');
  const cur = await getMemberPolicy(id);
  const sameType = cur?.memberTypeId === b.memberTypeId;
  const startFrom = sameType && cur && !cur.expired ? cur.endDate : undefined; // renewal extends from the old end date
  const term = await withTx(async (c) => {
    await exec(`UPDATE memberships SET status = 'expired' WHERE user_id = ? AND status = 'active'`, [id], c);
    const t = await startMembership(c, id, b.memberTypeId, req.user!.id, b.notes ?? (sameType ? 'Renewal' : 'Type change'), startFrom);
    await notify(id, 'membership', 'Membership updated', `Your membership is valid until ${t.end}.`, '/member/membership', c);
    return t;
  });
  await audit(req, req.user!.id, sameType ? 'membership.renew' : 'membership.change', 'user', id, { typeId: b.memberTypeId, ...term });
  ok(res, { policy: await getMemberPolicy(id) });
}));

membersRouter.get('/:id/memberships', wrap(async (req, res) => {
  const id = idParam(req);
  assertSelfOrStaff(req.user!, id);
  ok(res, await query(
    `SELECT m.id, t.name AS type, m.start_date AS startDate, m.end_date AS endDate, m.status, m.notes, m.created_at AS createdAt
       FROM memberships m JOIN member_types t ON t.id = m.member_type_id WHERE m.user_id = ? ORDER BY m.id DESC`, [id]));
}));
