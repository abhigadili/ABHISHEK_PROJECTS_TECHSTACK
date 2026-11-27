import { Router } from 'express';
import { z } from 'zod';
import { exec, query, queryOne } from '../lib/db';
import { audit } from '../lib/audit';
import { badRequest, conflict, notFound } from '../lib/errors';
import { idParam, ok, optDate, optStr, page, pagination, parse, wrap } from '../lib/http';
import { slugify } from '../lib/slug';
import { adminOnly, requireAuth, staffOnly, isStaff } from '../middleware/auth';

const like = (q: string) => `%${q.replace(/[%_]/g, '\\$&')}%`;
const statusEnum = z.enum(['active', 'archived']);

// ===== Categories ==========================================================================
export const categoriesRouter = Router();
const CAT = `SELECT c.id, c.name, c.slug, c.description, c.parent_id AS parentId, p.name AS parentName, c.status,
  c.created_at AS createdAt, c.updated_at AS updatedAt,
  (SELECT COUNT(DISTINCT bc.book_id) FROM book_categories bc JOIN books b ON b.id = bc.book_id AND b.status = 'active' WHERE bc.category_id = c.id) AS bookCount
  FROM categories c LEFT JOIN categories p ON p.id = c.parent_id`;

categoriesRouter.get('/', wrap(async (req, res) => {
  const staff = isStaff(req.user) && req.query.all === '1';
  ok(res, await query(`${CAT} ${staff ? '' : "WHERE c.status = 'active'"} ORDER BY COALESCE(p.name, c.name), c.parent_id IS NOT NULL, c.name`));
}));
categoriesRouter.get('/:id', wrap(async (req, res) => {
  const c = await queryOne(`${CAT} WHERE c.id = ?`, [idParam(req)]);
  if (!c) throw notFound('Category');
  ok(res, c);
}));

const catSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, 'Lowercase letters, digits and hyphens only').max(140).optional()),
  description: optStr(500),
  parentId: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.number().int().positive().nullable()),
  status: statusEnum.default('active'),
});
async function assertNoCycle(id: number | null, parentId: number | null) {
  let cur = parentId;
  for (let i = 0; cur && i < 20; i++) {
    if (cur === id) throw badRequest('A category cannot be its own ancestor', { parentId: 'Creates a cycle' });
    cur = (await queryOne<any>('SELECT parent_id FROM categories WHERE id = ?', [cur]))?.parent_id ?? null;
  }
}
categoriesRouter.post('/', requireAuth, staffOnly, wrap(async (req, res) => {
  const b = parse(catSchema, req.body);
  const slug = b.slug ?? slugify(b.name);
  if (await queryOne('SELECT 1 FROM categories WHERE slug = ? OR name = ?', [slug, b.name])) throw conflict('A category with this name or slug exists', { name: 'Already exists' });
  if (b.parentId) await assertNoCycle(null, b.parentId);
  const r = await exec('INSERT INTO categories (name, slug, description, parent_id, status) VALUES (?,?,?,?,?)', [b.name, slug, b.description, b.parentId, b.status]);
  await audit(req, req.user!.id, 'category.create', 'category', r.insertId, { name: b.name });
  ok(res, await queryOne(`${CAT} WHERE c.id = ?`, [r.insertId]), 201);
}));
categoriesRouter.put('/:id', requireAuth, staffOnly, wrap(async (req, res) => {
  const id = idParam(req); const b = parse(catSchema, req.body);
  if (!(await queryOne('SELECT 1 FROM categories WHERE id = ?', [id]))) throw notFound('Category');
  const slug = b.slug ?? slugify(b.name);
  if (await queryOne('SELECT 1 FROM categories WHERE (slug = ? OR name = ?) AND id <> ?', [slug, b.name, id])) throw conflict('A category with this name or slug exists', { name: 'Already exists' });
  await assertNoCycle(id, b.parentId);
  await exec('UPDATE categories SET name=?, slug=?, description=?, parent_id=?, status=? WHERE id=?', [b.name, slug, b.description, b.parentId, b.status, id]);
  await audit(req, req.user!.id, 'category.update', 'category', id);
  ok(res, await queryOne(`${CAT} WHERE c.id = ?`, [id]));
}));
categoriesRouter.delete('/:id', requireAuth, adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (!(await queryOne('SELECT 1 FROM categories WHERE id = ?', [id]))) throw notFound('Category');
  const used = (await queryOne<any>('SELECT (SELECT COUNT(*) FROM book_categories WHERE category_id = ?) + (SELECT COUNT(*) FROM categories WHERE parent_id = ?) AS n', [id, id]))!.n;
  if (used) {
    await exec("UPDATE categories SET status = 'archived' WHERE id = ?", [id]);
    await audit(req, req.user!.id, 'category.archive', 'category', id);
    return ok(res, { archived: true, reason: 'Category is in use, so it was archived instead of deleted' });
  }
  await exec('DELETE FROM categories WHERE id = ?', [id]);
  await audit(req, req.user!.id, 'category.delete', 'category', id);
  ok(res, { deleted: true });
}));

// ===== Authors =============================================================================
export const authorsRouter = Router();
const AUTH = `SELECT a.id, a.name, a.biography, a.nationality, a.date_of_birth AS dateOfBirth, a.image_url AS imageUrl, a.status,
  a.created_at AS createdAt, (SELECT COUNT(*) FROM book_authors ba WHERE ba.author_id = a.id) AS bookCount FROM authors a`;
authorsRouter.get('/', wrap(async (req, res) => {
  const p = pagination(req.query, 20, 200);
  const where: string[] = []; const args: any[] = [];
  if (req.query.q) { where.push('a.name LIKE ?'); args.push(like(String(req.query.q))); }
  if (!(isStaff(req.user) && req.query.all === '1')) where.push("a.status = 'active'");
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await queryOne<any>(`SELECT COUNT(*) AS n FROM authors a ${w}`, args))!.n;
  page(res, await query(`${AUTH} ${w} ORDER BY a.name LIMIT ? OFFSET ?`, [...args, p.pageSize, p.offset]), p, total);
}));
authorsRouter.get('/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const a = await queryOne<any>(`${AUTH} WHERE a.id = ?`, [id]);
  if (!a) throw notFound('Author');
  a.books = await query(`SELECT b.id, b.title, b.publication_year AS publicationYear, b.cover_url AS coverUrl FROM books b
    JOIN book_authors ba ON ba.book_id = b.id WHERE ba.author_id = ? AND b.status = 'active' ORDER BY b.title`, [id]);
  ok(res, a);
}));
const authorSchema = z.object({
  name: z.string().trim().min(2).max(190), biography: optStr(5000), nationality: optStr(80), dateOfBirth: optDate,
  imageUrl: z.preprocess((v) => (v === '' ? null : v), z.string().url().max(500).regex(/^https?:/).nullable().optional()).transform((v) => v ?? null),
  status: statusEnum.default('active'),
});
authorsRouter.post('/', requireAuth, staffOnly, wrap(async (req, res) => {
  const b = parse(authorSchema, req.body);
  const r = await exec('INSERT INTO authors (name, biography, nationality, date_of_birth, image_url, status) VALUES (?,?,?,?,?,?)', [b.name, b.biography, b.nationality, b.dateOfBirth, b.imageUrl, b.status]);
  await audit(req, req.user!.id, 'author.create', 'author', r.insertId, { name: b.name });
  ok(res, await queryOne(`${AUTH} WHERE a.id = ?`, [r.insertId]), 201);
}));
authorsRouter.put('/:id', requireAuth, staffOnly, wrap(async (req, res) => {
  const id = idParam(req); const b = parse(authorSchema, req.body);
  const r = await exec('UPDATE authors SET name=?, biography=?, nationality=?, date_of_birth=?, image_url=?, status=? WHERE id=?', [b.name, b.biography, b.nationality, b.dateOfBirth, b.imageUrl, b.status, id]);
  if (!r.affectedRows) throw notFound('Author');
  await audit(req, req.user!.id, 'author.update', 'author', id);
  ok(res, await queryOne(`${AUTH} WHERE a.id = ?`, [id]));
}));
authorsRouter.delete('/:id', requireAuth, adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (!(await queryOne('SELECT 1 FROM authors WHERE id = ?', [id]))) throw notFound('Author');
  if ((await queryOne<any>('SELECT COUNT(*) AS n FROM book_authors WHERE author_id = ?', [id]))!.n) {
    await exec("UPDATE authors SET status = 'archived' WHERE id = ?", [id]);
    await audit(req, req.user!.id, 'author.archive', 'author', id);
    return ok(res, { archived: true, reason: 'Author has books, so was archived instead of deleted' });
  }
  await exec('DELETE FROM authors WHERE id = ?', [id]);
  await audit(req, req.user!.id, 'author.delete', 'author', id);
  ok(res, { deleted: true });
}));

// ===== Publishers ==========================================================================
export const publishersRouter = Router();
const PUB = `SELECT p.id, p.name, p.address, p.email, p.phone, p.website, p.status, p.created_at AS createdAt,
  (SELECT COUNT(*) FROM books b WHERE b.publisher_id = p.id) AS bookCount FROM publishers p`;
publishersRouter.get('/', wrap(async (req, res) => {
  const p = pagination(req.query, 20, 200);
  const where: string[] = []; const args: any[] = [];
  if (req.query.q) { where.push('p.name LIKE ?'); args.push(like(String(req.query.q))); }
  if (!(isStaff(req.user) && req.query.all === '1')) where.push("p.status = 'active'");
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await queryOne<any>(`SELECT COUNT(*) AS n FROM publishers p ${w}`, args))!.n;
  page(res, await query(`${PUB} ${w} ORDER BY p.name LIMIT ? OFFSET ?`, [...args, p.pageSize, p.offset]), p, total);
}));
publishersRouter.get('/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const p = await queryOne<any>(`${PUB} WHERE p.id = ?`, [id]);
  if (!p) throw notFound('Publisher');
  p.books = await query(`SELECT b.id, b.title, b.publication_year AS publicationYear FROM books b WHERE b.publisher_id = ? AND b.status = 'active' ORDER BY b.title`, [id]);
  ok(res, p);
}));
const pubSchema = z.object({
  name: z.string().trim().min(2).max(190), address: optStr(255),
  email: z.preprocess((v) => (v === '' ? null : v), z.string().email().max(190).nullable().optional()).transform((v) => v ?? null),
  phone: optStr(40),
  website: z.preprocess((v) => (v === '' ? null : v), z.string().url().max(255).regex(/^https?:/).nullable().optional()).transform((v) => v ?? null),
  status: statusEnum.default('active'),
});
publishersRouter.post('/', requireAuth, staffOnly, wrap(async (req, res) => {
  const b = parse(pubSchema, req.body);
  if (await queryOne('SELECT 1 FROM publishers WHERE name = ?', [b.name])) throw conflict('Publisher already exists', { name: 'Already exists' });
  const r = await exec('INSERT INTO publishers (name, address, email, phone, website, status) VALUES (?,?,?,?,?,?)', [b.name, b.address, b.email, b.phone, b.website, b.status]);
  await audit(req, req.user!.id, 'publisher.create', 'publisher', r.insertId, { name: b.name });
  ok(res, await queryOne(`${PUB} WHERE p.id = ?`, [r.insertId]), 201);
}));
publishersRouter.put('/:id', requireAuth, staffOnly, wrap(async (req, res) => {
  const id = idParam(req); const b = parse(pubSchema, req.body);
  if (await queryOne('SELECT 1 FROM publishers WHERE name = ? AND id <> ?', [b.name, id])) throw conflict('Publisher already exists', { name: 'Already exists' });
  const r = await exec('UPDATE publishers SET name=?, address=?, email=?, phone=?, website=?, status=? WHERE id=?', [b.name, b.address, b.email, b.phone, b.website, b.status, id]);
  if (!r.affectedRows) throw notFound('Publisher');
  await audit(req, req.user!.id, 'publisher.update', 'publisher', id);
  ok(res, await queryOne(`${PUB} WHERE p.id = ?`, [id]));
}));
publishersRouter.delete('/:id', requireAuth, adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (!(await queryOne('SELECT 1 FROM publishers WHERE id = ?', [id]))) throw notFound('Publisher');
  if ((await queryOne<any>('SELECT COUNT(*) AS n FROM books WHERE publisher_id = ?', [id]))!.n) {
    await exec("UPDATE publishers SET status = 'archived' WHERE id = ?", [id]);
    await audit(req, req.user!.id, 'publisher.archive', 'publisher', id);
    return ok(res, { archived: true, reason: 'Publisher has books, so was archived instead of deleted' });
  }
  await exec('DELETE FROM publishers WHERE id = ?', [id]);
  await audit(req, req.user!.id, 'publisher.delete', 'publisher', id);
  ok(res, { deleted: true });
}));
