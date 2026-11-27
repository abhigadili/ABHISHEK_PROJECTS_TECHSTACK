import { Router } from 'express';
import { z } from 'zod';
import { exec, query, queryOne, withTx } from '../lib/db';
import { audit } from '../lib/audit';
import { badRequest, conflict, notFound } from '../lib/errors';
import { idParam, ok, page, pagination, parse, wrap } from '../lib/http';
import { hashPassword, passwordSchema, randomToken } from '../lib/password';
import { adminOnly, requireAuth } from '../middleware/auth';

export const staffRouter = Router();
staffRouter.use(requireAuth, adminOnly);

const SELECT = `SELECT u.id, u.email, u.full_name AS fullName, u.phone, u.status, u.status_reason AS statusReason,
  r.name AS role, u.last_login_at AS lastLoginAt, u.created_at AS createdAt
  FROM users u JOIN roles r ON r.id = u.role_id WHERE u.role_id IN (1,2)`;

staffRouter.get('/', wrap(async (req, res) => {
  const p = pagination(req.query);
  const args: any[] = []; let w = '';
  const q = String(req.query.q ?? '').trim();
  if (q) { w += ' AND (u.full_name LIKE ? OR u.email LIKE ?)'; const l = `%${q.replace(/[%_]/g, '\\$&')}%`; args.push(l, l); }
  if (req.query.role === 'admin' || req.query.role === 'librarian') { w += ' AND r.name = ?'; args.push(String(req.query.role)); }
  const total = (await queryOne<any>(`SELECT COUNT(*) AS n FROM (${SELECT}${w}) x`, args))!.n;
  page(res, await query(`${SELECT}${w} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`, [...args, p.pageSize, p.offset]), p, total);
}));

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().pipe(z.email().max(190)),
  phone: z.string().trim().max(30).nullish(),
  role: z.enum(['admin', 'librarian']),
  password: z.preprocess((v) => (v === '' ? undefined : v), passwordSchema.optional()),
});

staffRouter.post('/', wrap(async (req, res) => {
  const b = parse(createSchema, req.body);
  if (await queryOne('SELECT id FROM users WHERE email = ?', [b.email])) throw conflict('Email already registered', { email: 'Already registered' });
  const temp = b.password ? null : `${randomToken(6)}A1`;
  const r = await exec(`INSERT INTO users (email, password_hash, full_name, phone, role_id, status) VALUES (?,?,?,?,?,'active')`,
    [b.email, await hashPassword(b.password ?? temp!), b.fullName, b.phone ?? null, b.role === 'admin' ? 1 : 2]);
  await audit(req, req.user!.id, 'staff.create', 'user', r.insertId, { role: b.role });
  ok(res, { staff: await queryOne(`${SELECT} AND u.id = ?`, [r.insertId]), temporaryPassword: temp }, 201);
}));

async function activeAdminCountExcluding(id: number) {
  return (await queryOne<any>("SELECT COUNT(*) AS n FROM users WHERE role_id = 1 AND status = 'active' AND id <> ?", [id]))!.n as number;
}

staffRouter.patch('/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const b = parse(z.object({
    fullName: z.string().trim().min(2).max(150).optional(),
    phone: z.string().trim().max(30).nullish(),
    role: z.enum(['admin', 'librarian']).optional(),
  }), req.body);
  const t = await queryOne<any>('SELECT id, role_id FROM users WHERE id = ? AND role_id IN (1,2)', [id]);
  if (!t) throw notFound('Staff member');
  if (b.role && id === req.user!.id && b.role !== 'admin') throw badRequest('You cannot remove your own admin role');
  await exec('UPDATE users SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone), role_id = COALESCE(?, role_id) WHERE id = ?',
    [b.fullName ?? null, b.phone ?? null, b.role ? (b.role === 'admin' ? 1 : 2) : null, id]);
  if (b.role) await audit(req, req.user!.id, 'staff.role_change', 'user', id, { role: b.role });
  ok(res, await queryOne(`${SELECT} AND u.id = ?`, [id]));
}));

staffRouter.post('/:id/status', wrap(async (req, res) => {
  const id = idParam(req);
  const b = parse(z.object({ status: z.enum(['active', 'suspended', 'inactive']), reason: z.string().trim().max(255).optional() }), req.body);
  const t = await queryOne<any>('SELECT id, role_id FROM users WHERE id = ? AND role_id IN (1,2)', [id]);
  if (!t) throw notFound('Staff member');
  if (b.status !== 'active') {
    if (id === req.user!.id) throw badRequest('You cannot deactivate your own account');
    if (t.role_id === 1 && (await activeAdminCountExcluding(id)) === 0) throw badRequest('At least one active admin is required');
  }
  await withTx(async (c) => {
    await exec('UPDATE users SET status = ?, status_reason = ? WHERE id = ?', [b.status, b.status === 'active' ? null : b.reason ?? null, id], c);
    if (b.status !== 'active') await exec('DELETE FROM sessions WHERE user_id = ?', [id], c);
  });
  await audit(req, req.user!.id, `staff.${b.status}`, 'user', id, { reason: b.reason ?? null });
  ok(res, await queryOne(`${SELECT} AND u.id = ?`, [id]));
}));

// Admin-initiated password reset: returns a one-time temporary password (also revokes sessions).
staffRouter.post('/:id/reset-password', wrap(async (req, res) => {
  const id = idParam(req);
  if (!(await queryOne('SELECT id FROM users WHERE id = ?', [id]))) throw notFound('User');
  const temp = `${randomToken(6)}A1`;
  await exec('UPDATE users SET password_hash = ?, failed_login_count = 0, locked_until = NULL WHERE id = ?', [await hashPassword(temp), id]);
  await exec('DELETE FROM sessions WHERE user_id = ?', [id]);
  await audit(req, req.user!.id, 'user.password_reset_by_admin', 'user', id);
  ok(res, { temporaryPassword: temp });
}));
