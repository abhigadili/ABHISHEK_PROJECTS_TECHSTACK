import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env, isProd } from '../config/env';
import { exec, query, queryOne, withTx } from '../lib/db';
import { AppError, badRequest, conflict, forbidden, unauthorized } from '../lib/errors';
import { clientIp, ok, optDate, optStr, parse, wrap } from '../lib/http';
import { validateImage, upload } from '../lib/images';
import { getSettings } from '../lib/settings';
import { getMemberPolicy, startMembership } from '../lib/membership';
import { hashPassword, passwordSchema, randomToken, sha256, verifyPassword } from '../lib/password';
import { audit } from '../lib/audit';
import { notify } from '../lib/notify';
import { requireAuth } from '../middleware/auth';
import { authLimiter, registerLimiter, resetLimiter } from '../middleware/rateLimit';

export const authRouter = Router();

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
// Compared against when the email is unknown so response time doesn't reveal account existence.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', process.env.NODE_ENV === 'test' ? 4 : 12);

export const memberFields = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(150),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address').max(190)),
  phone: z.string().trim().min(6, 'Phone number is required').max(30).regex(/^[0-9+()\-.\s]+$/, 'Invalid phone number'),
  dateOfBirth: optDate,
  gender: z.preprocess((v) => (v === '' ? null : v), z.enum(['female', 'male', 'other', 'undisclosed']).nullable().optional()),
  address: z.string().trim().min(3, 'Address is required').max(255),
  city: z.string().trim().min(1, 'City is required').max(80),
  state: optStr(80),
  postalCode: z.string().trim().min(1, 'Postal code is required').max(20),
  country: z.string().trim().min(2, 'Country is required').max(80),
});
const dobInPast = (d: { dateOfBirth?: string | null }) => !d.dateOfBirth || Date.parse(d.dateOfBirth) < Date.now();

export const registrationSchema = memberFields.extend({
  password: passwordSchema,
  confirmPassword: z.string(),
  memberTypeId: z.preprocess((v) => (v === '' || v === undefined ? undefined : Number(v)), z.number().int().positive().optional()),
}).refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
  .refine(dobInPast, { path: ['dateOfBirth'], message: 'Date of birth must be in the past' });

export function setSessionCookie(res: Response, token: string) {
  res.cookie(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE, path: '/',
    maxAge: env.SESSION_TTL_HOURS * 3_600_000,
  });
}
export const clearSessionCookie = (res: Response) =>
  res.clearCookie(env.SESSION_COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE, path: '/' });

export async function createSession(req: Request, res: Response, userId: number) {
  const token = randomToken(32);
  await exec(
    `INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent)
     VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR), ?, ?)`,
    [sha256(token), userId, env.SESSION_TTL_HOURS, clientIp(req), (req.get('user-agent') ?? '').slice(0, 255)]);
  setSessionCookie(res, token);
}

export async function publicUser(userId: number) {
  const u = await queryOne<any>(
    `SELECT u.id, u.email, u.full_name AS fullName, u.phone, u.status, r.name AS role, u.created_at AS createdAt,
            mp.member_code AS memberCode, mp.registration_date AS registrationDate,
            (SELECT COUNT(*) FROM user_images ui WHERE ui.user_id = u.id) > 0 AS hasPicture,
            (SELECT updated_at FROM user_images ui WHERE ui.user_id = u.id) AS pictureUpdatedAt
       FROM users u JOIN roles r ON r.id = u.role_id LEFT JOIN member_profiles mp ON mp.user_id = u.id
      WHERE u.id = ?`, [userId]);
  if (!u) return null;
  u.hasPicture = !!u.hasPicture;
  u.membership = u.role === 'member' ? await getMemberPolicy(userId) : null;
  return u;
}

// --- Registration (always creates a Member; role is never client-controlled) ---------------
authRouter.post('/register', registerLimiter, upload.single('picture'), wrap(async (req, res) => {
  const body = parse(registrationSchema, req.body);
  const image = validateImage(req.file);
  const settings = await getSettings();

  const typeId = body.memberTypeId ?? settings.default_member_type_id;
  const type = await queryOne('SELECT id FROM member_types WHERE id = ? AND is_active = 1', [typeId]);
  if (!type) throw badRequest('Selected membership type is not available', { memberTypeId: 'Not available' });
  if (await queryOne('SELECT id FROM users WHERE email = ?', [body.email])) {
    throw conflict('An account with this email already exists', { email: 'Already registered' });
  }

  const hash = await hashPassword(body.password);
  const status = settings.registration_requires_approval ? 'pending' : 'active';
  const userId = await withTx(async (c) => {
    const r = await exec(
      `INSERT INTO users (email, password_hash, full_name, phone, role_id, status) VALUES (?,?,?,?,3,?)`,
      [body.email, hash, body.fullName, body.phone, status], c);
    const id = r.insertId;
    const code = `LM${new Date().getUTCFullYear()}${String(id).padStart(6, '0')}`;
    await exec(
      `INSERT INTO member_profiles (user_id, member_code, date_of_birth, gender, address, city, state, postal_code, country, registration_date)
       VALUES (?,?,?,?,?,?,?,?,?,CURDATE())`,
      [id, code, body.dateOfBirth, body.gender ?? null, body.address, body.city, body.state, body.postalCode, body.country], c);
    await startMembership(c, id, typeId, null, 'Self registration');
    if (image) {
      await exec('INSERT INTO user_images (user_id, mime_type, size_bytes, sha256, data) VALUES (?,?,?,?,?)',
        [id, image.mime, image.size, image.sha, image.data], c);
    }
    await notify(id, 'welcome', 'Welcome to the library',
      status === 'active' ? 'Your membership is active. Happy reading!' : 'Your registration is awaiting approval by library staff.',
      '/member/dashboard', c);
    return id;
  });
  await audit(req, userId, 'member.register', 'user', userId, { status });
  if (status === 'active') await createSession(req, res, userId);
  ok(res, { user: await publicUser(userId), pendingApproval: status === 'pending' }, 201);
}));

// --- Login / logout ----------------------------------------------------------------------
const loginSchema = z.object({ email: z.string().trim().toLowerCase().min(1), password: z.string().min(1).max(200) });

authRouter.post('/login', authLimiter, wrap(async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const u = await queryOne<any>('SELECT * FROM users WHERE email = ?', [email]);
  if (u?.locked_until && new Date(u.locked_until) > new Date()) {
    throw new AppError(429, 'ACCOUNT_LOCKED', 'Too many failed attempts. Try again later.');
  }
  const good = await verifyPassword(password, u?.password_hash ?? DUMMY_HASH);
  if (!u || !good) {
    if (u) {
      const failed = u.failed_login_count + 1;
      const lock = failed >= MAX_FAILED;
      await exec(
        `UPDATE users SET failed_login_count = ?, locked_until = ${lock ? 'DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE)' : 'NULL'} WHERE id = ?`,
        lock ? [0, LOCK_MINUTES, u.id] : [failed, u.id]);
      if (lock) await audit(req, u.id, 'auth.lockout', 'user', u.id);
    }
    throw unauthorized('Invalid email or password');
  }
  if (u.status === 'suspended') throw forbidden('Your account is suspended. Please contact the library.');
  if (u.status === 'inactive') throw forbidden('Your account is inactive. Please contact the library.');
  await exec('UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP() WHERE id = ?', [u.id]);
  await createSession(req, res, u.id);
  ok(res, { user: await publicUser(u.id) });
}));

authRouter.post('/logout', wrap(async (req, res) => {
  if (req.sessionId) await exec('DELETE FROM sessions WHERE id = ?', [req.sessionId]);
  clearSessionCookie(res);
  ok(res, { loggedOut: true });
}));

authRouter.get('/me', requireAuth, wrap(async (req, res) => {
  ok(res, { user: await publicUser(req.user!.id) });
}));

// --- Password management -----------------------------------------------------------------
const changePwSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

authRouter.post('/change-password', requireAuth, authLimiter, wrap(async (req, res) => {
  const b = parse(changePwSchema, req.body);
  const u = await queryOne<any>('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
  if (!(await verifyPassword(b.currentPassword, u.password_hash))) {
    throw badRequest('Current password is incorrect', { currentPassword: 'Incorrect password' });
  }
  if (b.currentPassword === b.newPassword) throw badRequest('Choose a different password', { newPassword: 'Must differ from current' });
  await exec('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(b.newPassword), req.user!.id]);
  await exec('DELETE FROM sessions WHERE user_id = ? AND id <> ?', [req.user!.id, req.sessionId ?? '']);
  await audit(req, req.user!.id, 'auth.password_change', 'user', req.user!.id);
  ok(res, { changed: true });
}));

authRouter.post('/forgot-password', resetLimiter, wrap(async (req, res) => {
  const { email } = parse(z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) }), req.body);
  const u = await queryOne<any>("SELECT id, status FROM users WHERE email = ? AND status IN ('active','pending')", [email]);
  let devLink: string | undefined;
  if (u) {
    const token = randomToken(32);
    await exec('UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND used_at IS NULL', [u.id]);
    await exec(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))`, [u.id, sha256(token), env.PASSWORD_RESET_TTL_MINUTES]);
    const link = `${env.APP_BASE_URL}/reset-password?token=${token}`;
    await audit(req, u.id, 'auth.password_reset_requested', 'user', u.id);
    // No email provider is bundled: the link is logged for the operator (never in production unless opted in).
    if (!isProd) console.log(`[password-reset] link for ${email}: ${link}`);
    if (env.EXPOSE_RESET_LINK && !isProd) devLink = link;
  }
  // Same response whether or not the account exists (prevents account enumeration).
  ok(res, { message: 'If that email is registered, a reset link has been generated.', ...(devLink ? { devResetLink: devLink } : {}) });
}));

authRouter.post('/reset-password', resetLimiter, wrap(async (req, res) => {
  const b = parse(z.object({ token: z.string().min(20).max(200), newPassword: passwordSchema, confirmPassword: z.string() })
    .refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' }), req.body);
  const hash = await hashPassword(b.newPassword);
  const userId = await withTx(async (c) => {
    const [rows] = await c.query(
      'SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP() FOR UPDATE',
      [sha256(b.token)]) as any;
    if (!rows[0]) throw badRequest('This reset link is invalid or has expired');
    await c.query('UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ?', [rows[0].id]);
    await c.query('UPDATE users SET password_hash = ?, failed_login_count = 0, locked_until = NULL WHERE id = ?', [hash, rows[0].user_id]);
    await c.query('DELETE FROM sessions WHERE user_id = ?', [rows[0].user_id]);
    return rows[0].user_id as number;
  });
  await audit(req, userId, 'auth.password_reset', 'user', userId);
  ok(res, { reset: true });
}));
