import { Router } from 'express';
import { z } from 'zod';
import { exec, queryOne } from '../lib/db';
import { assertCanManageUser } from '../lib/access';
import { audit } from '../lib/audit';
import { notFound, badRequest } from '../lib/errors';
import { idParam, ok, optDate, optStr, parse, wrap } from '../lib/http';
import { upload, validateImage } from '../lib/images';
import { requireAuth } from '../middleware/auth';
import { publicUser } from './auth';

export const profileRouter = Router();
profileRouter.use(requireAuth);

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(150).optional(),
  phone: z.string().trim().min(6).max(30).regex(/^[0-9+()\-.\s]+$/, 'Invalid phone number').optional(),
  dateOfBirth: optDate.optional(),
  gender: z.preprocess((v) => (v === '' ? null : v), z.enum(['female', 'male', 'other', 'undisclosed']).nullable().optional()),
  address: optStr(255).optional(),
  city: optStr(80).optional(),
  state: optStr(80).optional(),
  postalCode: optStr(20).optional(),
  country: optStr(80).optional(),
});

export async function applyProfileUpdate(userId: number, b: z.infer<typeof profileUpdateSchema>) {
  const userCols: Record<string, unknown> = { full_name: b.fullName, phone: b.phone };
  const profCols: Record<string, unknown> = {
    date_of_birth: b.dateOfBirth, gender: b.gender, address: b.address, city: b.city,
    state: b.state, postal_code: b.postalCode, country: b.country,
  };
  for (const [table, cols, key] of [['users', userCols, 'id'], ['member_profiles', profCols, 'user_id']] as const) {
    const entries = Object.entries(cols).filter(([, v]) => v !== undefined);
    if (!entries.length) continue;
    // Column names come from the fixed maps above, never from user input.
    await exec(`UPDATE ${table} SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE ${key} = ?`,
      [...entries.map(([, v]) => v as any), userId]);
  }
}

profileRouter.get('/', wrap(async (req, res) => {
  const user = await publicUser(req.user!.id);
  const details = await queryOne(
    `SELECT date_of_birth AS dateOfBirth, gender, address, city, state, postal_code AS postalCode, country
       FROM member_profiles WHERE user_id = ?`, [req.user!.id]);
  ok(res, { ...user, ...(details ?? {}) });
}));

profileRouter.patch('/', wrap(async (req, res) => {
  const b = parse(profileUpdateSchema, req.body);
  await applyProfileUpdate(req.user!.id, b);
  await audit(req, req.user!.id, 'profile.update', 'user', req.user!.id);
  ok(res, await publicUser(req.user!.id));
}));

// --- Profile picture (bytes live in MySQL, table user_images) -----------------------------
export const pictureRouter = Router();

// Picture of self (and of members for staff). Private caching, revalidated via ETag.
pictureRouter.get('/:id/picture', requireAuth, wrap(async (req, res) => {
  const id = idParam(req);
  if (id !== req.user!.id) await assertCanManageUser(req.user!, id);
  const img = await queryOne<any>('SELECT mime_type, size_bytes, sha256, data FROM user_images WHERE user_id = ?', [id]);
  if (!img) throw notFound('Picture');
  const etag = `"${img.sha256}"`;
  res.set({ 'Cache-Control': 'private, max-age=0, must-revalidate', ETag: etag, 'X-Content-Type-Options': 'nosniff' });
  if (req.get('if-none-match') === etag) return void res.status(304).end();
  res.set({ 'Content-Type': img.mime_type, 'Content-Length': String(img.size_bytes) });
  res.end(img.data);
}));

pictureRouter.put('/:id/picture', requireAuth, upload.single('picture'), wrap(async (req, res) => {
  const id = idParam(req);
  await assertCanManageUser(req.user!, id);
  const img = validateImage(req.file);
  if (!img) throw badRequest('Choose an image to upload', { picture: 'Required' });
  await exec(
    `INSERT INTO user_images (user_id, mime_type, size_bytes, sha256, data) VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), size_bytes = VALUES(size_bytes),
                             sha256 = VALUES(sha256), data = VALUES(data)`,
    [id, img.mime, img.size, img.sha, img.data]);
  await audit(req, req.user!.id, 'profile.picture_set', 'user', id, { bytes: img.size, mime: img.mime });
  ok(res, { hasPicture: true, mimeType: img.mime, sizeBytes: img.size });
}));

pictureRouter.delete('/:id/picture', requireAuth, wrap(async (req, res) => {
  const id = idParam(req);
  await assertCanManageUser(req.user!, id);
  await exec('DELETE FROM user_images WHERE user_id = ?', [id]);
  await audit(req, req.user!.id, 'profile.picture_removed', 'user', id);
  ok(res, { hasPicture: false });
}));
