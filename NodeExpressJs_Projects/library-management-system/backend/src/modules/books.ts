import { Router } from 'express';
import type { PoolConnection } from 'mysql2/promise';
import { z } from 'zod';
import { exec, query, queryOne, withTx } from '../lib/db';
import { audit } from '../lib/audit';
import { badRequest, conflict, notFound, unprocessable } from '../lib/errors';
import { idParam, isoDate, money, ok, optDate, optStr, page, pagination, parse, wrap, emptyToNull } from '../lib/http';
import { validIsbn10, validIsbn13 } from '../lib/slug';
import { allocateForBook } from '../lib/reservations';
import { adminOnly, isStaff, requireAuth, staffOnly } from '../middleware/auth';
import { todayStr } from '../lib/dates';

export const booksRouter = Router();
export const copiesRouter = Router();

const like = (q: string) => `%${q.replace(/[%_]/g, '\\$&')}%`;

// Copy counts always come from the physical copy records, so they cannot drift.
const BOOK_LIST_SQL = `
  SELECT b.id, b.title, b.subtitle, b.isbn10, b.isbn13, b.publication_year AS publicationYear, b.language, b.format,
         b.cover_url AS coverUrl, b.location, b.status, b.created_at AS createdAt, b.pages, b.edition,
         b.publisher_id AS publisherId, p.name AS publisherName,
         (SELECT GROUP_CONCAT(a.name ORDER BY ba.position SEPARATOR ', ') FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id) AS authors,
         (SELECT GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') FROM book_categories bc JOIN categories c ON c.id = bc.category_id WHERE bc.book_id = b.id) AS categories,
         COALESCE(cc.total, 0) AS totalCopies, COALESCE(cc.avail, 0) AS availableCopies, COALESCE(cc.borrowed, 0) AS borrowedCopies,
         COALESCE(cc.reserved, 0) AS reservedCopies, COALESCE(cc.damaged, 0) AS damagedCopies, COALESCE(cc.lost, 0) AS lostCopies,
         COALESCE(lc.n, 0) AS timesBorrowed, rv.avg AS avgRating, COALESCE(rv.n, 0) AS ratingCount
    FROM books b
    LEFT JOIN publishers p ON p.id = b.publisher_id
    LEFT JOIN (SELECT book_id, SUM(status <> 'withdrawn') AS total, SUM(status = 'available') AS avail, SUM(status = 'on_loan') AS borrowed,
                      SUM(status = 'held') AS reserved, SUM(status = 'damaged') AS damaged, SUM(status = 'lost') AS lost
                 FROM book_copies GROUP BY book_id) cc ON cc.book_id = b.id
    LEFT JOIN (SELECT book_id, COUNT(*) AS n FROM loans GROUP BY book_id) lc ON lc.book_id = b.id
    LEFT JOIN (SELECT book_id, ROUND(AVG(rating), 1) AS avg, COUNT(*) AS n FROM reviews WHERE status = 'approved' GROUP BY book_id) rv ON rv.book_id = b.id`;

function shape(r: any) {
  const n = (k: string) => Number(r[k] ?? 0);
  return {
    ...r,
    totalCopies: n('totalCopies'), availableCopies: n('availableCopies'), borrowedCopies: n('borrowedCopies'),
    reservedCopies: n('reservedCopies'), damagedCopies: n('damagedCopies'), lostCopies: n('lostCopies'),
    timesBorrowed: n('timesBorrowed'), ratingCount: n('ratingCount'), avgRating: r.avgRating === null ? null : Number(r.avgRating),
    availability: n('availableCopies') > 0 ? 'available' : n('totalCopies') === 0 ? 'unavailable' : (n('borrowedCopies') + n('reservedCopies')) > 0 ? 'borrowed' : 'unavailable',
  };
}

const SORTS: Record<string, string> = {
  title: 'b.title ASC', newest: 'b.created_at DESC, b.id DESC', year: 'b.publication_year DESC, b.title',
  popularity: 'timesBorrowed DESC, b.title', availability: 'availableCopies DESC, b.title',
};

booksRouter.get('/', wrap(async (req, res) => {
  const p = pagination(req.query, 12, 100);
  const where: string[] = []; const args: any[] = [];
  const q = String(req.query.q ?? '').trim();
  if (q) {
    const l = like(q);
    where.push(`(b.title LIKE ? OR b.subtitle LIKE ? OR b.isbn10 = ? OR b.isbn13 = ? OR b.description LIKE ?
      OR EXISTS (SELECT 1 FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id AND a.name LIKE ?)
      OR EXISTS (SELECT 1 FROM book_categories bc JOIN categories c ON c.id = bc.category_id WHERE bc.book_id = b.id AND c.name LIKE ?)
      OR p.name LIKE ?)`);
    const isbn = q.replace(/[-\s]/g, '');
    args.push(l, l, isbn, isbn, l, l, l, l);
  }
  const field = (name: string, sql: string, v?: unknown) => { if (v !== undefined && v !== '') { where.push(sql); args.push(v); } };
  field('title', 'b.title LIKE ?', req.query.title ? like(String(req.query.title)) : undefined);
  if (req.query.isbn) { const i = String(req.query.isbn).replace(/[-\s]/g, ''); where.push('(b.isbn10 = ? OR b.isbn13 = ?)'); args.push(i, i); }
  if (req.query.author) { where.push('EXISTS (SELECT 1 FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id AND a.name LIKE ?)'); args.push(like(String(req.query.author))); }
  if (req.query.authorId) { where.push('EXISTS (SELECT 1 FROM book_authors ba WHERE ba.book_id = b.id AND ba.author_id = ?)'); args.push(Number(req.query.authorId)); }
  if (req.query.categoryId) {
    // include sub-categories of the chosen category
    where.push('EXISTS (SELECT 1 FROM book_categories bc JOIN categories c ON c.id = bc.category_id WHERE bc.book_id = b.id AND (c.id = ? OR c.parent_id = ?))');
    args.push(Number(req.query.categoryId), Number(req.query.categoryId));
  }
  if (req.query.publisherId) { where.push('b.publisher_id = ?'); args.push(Number(req.query.publisherId)); }
  if (req.query.publisher) { where.push('p.name LIKE ?'); args.push(like(String(req.query.publisher))); }
  field('language', 'b.language = ?', req.query.language);
  field('format', 'b.format = ?', req.query.format);
  field('yearFrom', 'b.publication_year >= ?', req.query.yearFrom ? Number(req.query.yearFrom) : undefined);
  field('yearTo', 'b.publication_year <= ?', req.query.yearTo ? Number(req.query.yearTo) : undefined);
  if (req.query.availability === 'available') where.push('COALESCE(cc.avail, 0) > 0');
  if (req.query.availability === 'unavailable') where.push('COALESCE(cc.avail, 0) = 0');
  // Only staff may look at archived books.
  const status = isStaff(req.user) && req.query.status ? String(req.query.status) : 'active';
  if (status !== 'all') { where.push('b.status = ?'); args.push(status === 'archived' ? 'archived' : 'active'); }

  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const order = SORTS[String(req.query.sort ?? 'title')] ?? SORTS.title;
  const total = (await queryOne<any>(`SELECT COUNT(*) AS n FROM (${BOOK_LIST_SQL} ${w}) x`, args))!.n;
  const rows = await query(`${BOOK_LIST_SQL} ${w} ORDER BY ${order} LIMIT ? OFFSET ?`, [...args, p.pageSize, p.offset]);
  page(res, rows.map(shape), p, total);
}));

booksRouter.get('/recent', wrap(async (req, res) => {
  const limit = Math.min(24, Number(req.query.limit) || 8);
  ok(res, (await query(`${BOOK_LIST_SQL} WHERE b.status = 'active' ORDER BY b.created_at DESC, b.id DESC LIMIT ?`, [limit])).map(shape));
}));
booksRouter.get('/popular', wrap(async (req, res) => {
  const limit = Math.min(24, Number(req.query.limit) || 8);
  const rows = await query(`${BOOK_LIST_SQL} WHERE b.status = 'active' AND COALESCE(lc.n, 0) > 0 ORDER BY timesBorrowed DESC, b.title LIMIT ?`, [limit]);
  ok(res, rows.map(shape));
}));
booksRouter.get('/languages', wrap(async (_req, res) => {
  ok(res, (await query("SELECT DISTINCT language FROM books WHERE status = 'active' ORDER BY language")).map((r: any) => r.language));
}));

booksRouter.get('/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const row = await queryOne<any>(`${BOOK_LIST_SQL} WHERE b.id = ?`, [id]);
  if (!row || (row.status === 'archived' && !isStaff(req.user))) throw notFound('Book');
  const book: any = shape(row);
  const full = await queryOne<any>('SELECT description, acquisition_date AS acquisitionDate, acquisition_cost AS acquisitionCost, updated_at AS updatedAt FROM books WHERE id = ?', [id]);
  Object.assign(book, full);
  if (!isStaff(req.user)) delete book.acquisitionCost;
  book.authorList = await query('SELECT a.id, a.name FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = ? ORDER BY ba.position', [id]);
  book.categoryList = await query('SELECT c.id, c.name, c.slug FROM book_categories bc JOIN categories c ON c.id = bc.category_id WHERE bc.book_id = ? ORDER BY c.name', [id]);
  book.related = (await query(`${BOOK_LIST_SQL} WHERE b.status = 'active' AND b.id <> ? AND (
      EXISTS (SELECT 1 FROM book_categories x JOIN book_categories y ON y.category_id = x.category_id WHERE x.book_id = b.id AND y.book_id = ?)
      OR EXISTS (SELECT 1 FROM book_authors x JOIN book_authors y ON y.author_id = x.author_id WHERE x.book_id = b.id AND y.book_id = ?))
    ORDER BY timesBorrowed DESC, b.title LIMIT 6`, [id, id, id])).map(shape);
  if (req.user) {
    book.isFavorite = !!(await queryOne('SELECT 1 FROM favorites WHERE user_id = ? AND book_id = ?', [req.user.id, id]));
    book.myReservation = await queryOne("SELECT id, status, expires_at AS expiresAt FROM reservations WHERE user_id = ? AND book_id = ? AND status IN ('pending','ready')", [req.user.id, id]);
    book.myActiveLoan = await queryOne("SELECT id, due_date AS dueDate FROM loans WHERE user_id = ? AND book_id = ? AND status = 'active'", [req.user.id, id]);
  }
  ok(res, book);
}));

// ---- create / update -----------------------------------------------------------------------
const isbnField = (len: 10 | 13) =>
  z.preprocess((v) => (typeof v === 'string' ? v.replace(/[-\s]/g, '').toUpperCase() || null : v ?? null),
    z.string().nullable().refine((s) => s === null || (len === 10 ? validIsbn10(s) : validIsbn13(s)), `Invalid ISBN-${len}`));

const bookSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  subtitle: optStr(255), description: optStr(10000),
  isbn10: isbnField(10), isbn13: isbnField(13),
  authorIds: z.array(z.coerce.number().int().positive()).min(1, 'At least one author is required').max(20),
  categoryIds: z.array(z.coerce.number().int().positive()).max(20).default([]),
  publisherId: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.number().int().positive().nullable()),
  edition: optStr(40),
  publicationYear: z.preprocess((v) => (v === '' || v === undefined || v === null ? null : v), z.coerce.number().int().min(1000).max(new Date().getFullYear() + 1).nullable()),
  language: z.string().trim().min(2).max(40).default('English'),
  pages: z.preprocess((v) => (v === '' || v === undefined || v === null ? null : v), z.coerce.number().int().min(1).max(20000).nullable()),
  coverUrl: z.preprocess((v) => (v === '' ? null : v), z.string().url().max(500).regex(/^https?:\/\//, 'Must be an http(s) URL').nullable().optional()).transform((v) => v ?? null),
  location: optStr(100),
  format: z.enum(['hardcover', 'paperback', 'ebook', 'audiobook', 'other']).default('paperback'),
  acquisitionDate: optDate,
  acquisitionCost: z.preprocess((v) => (v === '' || v === undefined || v === null ? null : v), money.nullable()),
  copies: z.coerce.number().int().min(0).max(200).default(1),
});
type BookInput = z.infer<typeof bookSchema>;

async function assertRefs(b: BookInput, conn: PoolConnection) {
  const authors = await query<any>(`SELECT id FROM authors WHERE id IN (${b.authorIds.map(() => '?').join(',')})`, b.authorIds, conn);
  if (authors.length !== new Set(b.authorIds).size) throw badRequest('One or more authors do not exist', { authorIds: 'Unknown author' });
  if (b.categoryIds.length) {
    const cats = await query<any>(`SELECT id FROM categories WHERE id IN (${b.categoryIds.map(() => '?').join(',')})`, b.categoryIds, conn);
    if (cats.length !== new Set(b.categoryIds).size) throw badRequest('One or more categories do not exist', { categoryIds: 'Unknown category' });
  }
  if (b.publisherId && !(await queryOne('SELECT 1 FROM publishers WHERE id = ?', [b.publisherId], conn))) throw badRequest('Publisher does not exist', { publisherId: 'Unknown publisher' });
}
async function assertIsbnFree(b: BookInput, selfId: number | null, conn: PoolConnection) {
  for (const col of ['isbn10', 'isbn13'] as const) {
    if (b[col] && await queryOne(`SELECT 1 FROM books WHERE ${col} = ? AND id <> ?`, [b[col]!, selfId ?? 0], conn)) {
      throw conflict(`A book with this ${col === 'isbn10' ? 'ISBN-10' : 'ISBN-13'} already exists`, { [col]: 'Already exists' });
    }
  }
}
/**
 * Sync author/category links by diffing against the current rows (no blanket DELETE): deleting a
 * range that matches nothing takes gap locks, and concurrent inserts into the same gap deadlock.
 */
async function setLinks(c: PoolConnection, bookId: number, b: BookInput) {
  const aids = [...new Set(b.authorIds)];
  const curA = (await query<any>('SELECT author_id FROM book_authors WHERE book_id = ?', [bookId], c)).map((r) => r.author_id as number);
  for (const id of curA.filter((x) => !aids.includes(x))) await exec('DELETE FROM book_authors WHERE book_id = ? AND author_id = ?', [bookId, id], c);
  for (let i = 0; i < aids.length; i++) {
    if (curA.includes(aids[i])) await exec('UPDATE book_authors SET position = ? WHERE book_id = ? AND author_id = ?', [i, bookId, aids[i]], c);
    else await exec('INSERT INTO book_authors (book_id, author_id, position) VALUES (?,?,?)', [bookId, aids[i], i], c);
  }
  const cids = [...new Set(b.categoryIds)];
  const curC = (await query<any>('SELECT category_id FROM book_categories WHERE book_id = ?', [bookId], c)).map((r) => r.category_id as number);
  for (const id of curC.filter((x) => !cids.includes(x))) await exec('DELETE FROM book_categories WHERE book_id = ? AND category_id = ?', [bookId, id], c);
  for (const id of cids.filter((x) => !curC.includes(x))) await exec('INSERT INTO book_categories (book_id, category_id) VALUES (?,?)', [bookId, id], c);
}

export async function addCopies(c: PoolConnection, bookId: number, count: number, shelf: string | null, notes: string | null = null, accession?: string) {
  const ids: number[] = [];
  const row = await queryOne<any>("SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(accession_number, '-', -1) AS UNSIGNED)), 0) AS m FROM book_copies WHERE book_id = ? AND accession_number REGEXP ?",
    [bookId, `^ACC-${String(bookId).padStart(5, '0')}-[0-9]+$`], c);
  let seq = row?.m ?? 0;
  for (let i = 0; i < count; i++) {
    const acc = accession && count === 1 ? accession : `ACC-${String(bookId).padStart(5, '0')}-${++seq}`;
    if (await queryOne('SELECT 1 FROM book_copies WHERE accession_number = ?', [acc], c)) throw conflict(`Accession number ${acc} already exists`, { accessionNumber: 'Already exists' });
    const r = await exec('INSERT INTO book_copies (book_id, accession_number, shelf_location, condition_notes, acquired_on) VALUES (?,?,?,?,?)', [bookId, acc, shelf, notes, todayStr()], c);
    ids.push(r.insertId);
  }
  // new available stock may satisfy waiting reservations
  await allocateForBook(c, bookId);
  return ids;
}

booksRouter.post('/', requireAuth, staffOnly, wrap(async (req, res) => {
  const b = parse(bookSchema, req.body);
  const id = await withTx(async (c) => {
    await assertRefs(b, c); await assertIsbnFree(b, null, c);
    const r = await exec(`INSERT INTO books (isbn10, isbn13, title, subtitle, description, publisher_id, edition, publication_year, language, pages,
      cover_url, location, format, acquisition_date, acquisition_cost, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [b.isbn10, b.isbn13, b.title, b.subtitle, b.description, b.publisherId, b.edition, b.publicationYear, b.language, b.pages,
        b.coverUrl, b.location, b.format, b.acquisitionDate, b.acquisitionCost, req.user!.id], c);
    await setLinks(c, r.insertId, b);
    if (b.copies) await addCopies(c, r.insertId, b.copies, b.location);
    return r.insertId;
  });
  await audit(req, req.user!.id, 'book.create', 'book', id, { title: b.title, copies: b.copies });
  ok(res, shape(await queryOne(`${BOOK_LIST_SQL} WHERE b.id = ?`, [id])), 201);
}));

booksRouter.put('/:id', requireAuth, staffOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const b = parse(bookSchema.omit({ copies: true }), req.body);
  await withTx(async (c) => {
    if (!(await queryOne('SELECT 1 FROM books WHERE id = ? FOR UPDATE', [id], c))) throw notFound('Book');
    const full = { ...b, copies: 0 } as BookInput;
    await assertRefs(full, c); await assertIsbnFree(full, id, c);
    await exec(`UPDATE books SET isbn10=?, isbn13=?, title=?, subtitle=?, description=?, publisher_id=?, edition=?, publication_year=?, language=?, pages=?,
      cover_url=?, location=?, format=?, acquisition_date=?, acquisition_cost=? WHERE id=?`,
      [b.isbn10, b.isbn13, b.title, b.subtitle, b.description, b.publisherId, b.edition, b.publicationYear, b.language, b.pages,
        b.coverUrl, b.location, b.format, b.acquisitionDate, b.acquisitionCost, id], c);
    await setLinks(c, id, full);
  });
  await audit(req, req.user!.id, 'book.update', 'book', id, { title: b.title });
  ok(res, shape(await queryOne(`${BOOK_LIST_SQL} WHERE b.id = ?`, [id])));
}));

// Archive / restore: books with history are never hard-deleted.
booksRouter.post('/:id/archive', requireAuth, staffOnly, wrap(async (req, res) => {
  const id = idParam(req);
  await withTx(async (c) => {
    if (!(await queryOne('SELECT 1 FROM books WHERE id = ? FOR UPDATE', [id], c))) throw notFound('Book');
    const busy = await queryOne<any>(`SELECT (SELECT COUNT(*) FROM loans WHERE book_id = ? AND status = 'active') AS loans,
      (SELECT COUNT(*) FROM reservations WHERE book_id = ? AND status IN ('pending','ready')) AS res`, [id, id], c);
    if (busy.loans) throw unprocessable(`Cannot archive: ${busy.loans} copy(ies) are currently on loan`);
    if (busy.res) throw unprocessable(`Cannot archive: ${busy.res} open reservation(s) exist - cancel them first`);
    await exec("UPDATE books SET status = 'archived' WHERE id = ?", [id], c);
  });
  await audit(req, req.user!.id, 'book.archive', 'book', id);
  ok(res, { archived: true });
}));
booksRouter.post('/:id/restore', requireAuth, staffOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const r = await exec("UPDATE books SET status = 'active' WHERE id = ?", [id]);
  if (!r.affectedRows) throw notFound('Book');
  await audit(req, req.user!.id, 'book.restore', 'book', id);
  ok(res, { archived: false });
}));
booksRouter.delete('/:id', requireAuth, adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const result = await withTx(async (c) => {
    if (!(await queryOne('SELECT 1 FROM books WHERE id = ? FOR UPDATE', [id], c))) throw notFound('Book');
    const hist = await queryOne<any>(`SELECT (SELECT COUNT(*) FROM loans WHERE book_id = ?) AS loans,
      (SELECT COUNT(*) FROM reservations WHERE book_id = ?) AS res`, [id, id], c);
    if (hist.loans || hist.res) throw unprocessable('This book has circulation history and cannot be deleted. Archive it instead.');
    await exec('DELETE FROM book_copies WHERE book_id = ?', [id], c);
    await exec('DELETE FROM books WHERE id = ?', [id], c);
    return true;
  });
  await audit(req, req.user!.id, 'book.delete', 'book', id);
  ok(res, { deleted: result });
}));

// ---- copies ---------------------------------------------------------------------------------
const COPY_SQL = `SELECT bc.id, bc.book_id AS bookId, bc.accession_number AS accessionNumber, bc.status, bc.shelf_location AS shelfLocation,
  bc.condition_notes AS conditionNotes, bc.acquired_on AS acquiredOn, bc.created_at AS createdAt,
  (SELECT l.id FROM loans l WHERE l.copy_id = bc.id AND l.status = 'active') AS loanId,
  (SELECT u.full_name FROM loans l JOIN users u ON u.id = l.user_id WHERE l.copy_id = bc.id AND l.status = 'active') AS borrower,
  (SELECT l.due_date FROM loans l WHERE l.copy_id = bc.id AND l.status = 'active') AS dueDate,
  (SELECT COUNT(*) FROM loans l WHERE l.copy_id = bc.id) AS timesLoaned
  FROM book_copies bc`;

booksRouter.get('/:id/copies', requireAuth, staffOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (!(await queryOne('SELECT 1 FROM books WHERE id = ?', [id]))) throw notFound('Book');
  ok(res, await query(`${COPY_SQL} WHERE bc.book_id = ? ORDER BY bc.id`, [id]));
}));

booksRouter.post('/:id/copies', requireAuth, staffOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const b = parse(z.object({
    count: z.coerce.number().int().min(1).max(100).default(1),
    accessionNumber: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().regex(/^[A-Za-z0-9._-]{3,40}$/, 'Letters, digits, . _ - only').optional()),
    shelfLocation: optStr(100), conditionNotes: optStr(255),
  }), req.body);
  const ids = await withTx(async (c) => {
    const bk = await queryOne<any>('SELECT status FROM books WHERE id = ? FOR UPDATE', [id], c);
    if (!bk) throw notFound('Book');
    if (bk.status === 'archived') throw unprocessable('Restore the book before adding copies');
    return addCopies(c, id, b.count, b.shelfLocation, b.conditionNotes, b.accessionNumber);
  });
  await audit(req, req.user!.id, 'copy.add', 'book', id, { count: b.count, copyIds: ids });
  ok(res, await query(`${COPY_SQL} WHERE bc.book_id = ? ORDER BY bc.id`, [id]), 201);
}));

// Status transitions for a physical copy. Copies on loan must be returned through circulation.
copiesRouter.use(requireAuth, staffOnly);
copiesRouter.patch('/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const b = parse(z.object({
    status: z.enum(['available', 'damaged', 'lost', 'withdrawn']).optional(),
    shelfLocation: emptyToNull(z.string().trim().max(100)).optional(),
    conditionNotes: emptyToNull(z.string().trim().max(255)).optional(),
  }), req.body);
  await withTx(async (c) => {
    const copy = await queryOne<any>('SELECT id, book_id, status FROM book_copies WHERE id = ? FOR UPDATE', [id], c);
    if (!copy) throw notFound('Copy');
    if (copy.status === 'on_loan') throw unprocessable('This copy is on loan - process the return first');
    if (b.status && b.status !== copy.status) {
      if (copy.status === 'held') {
        // the member waiting for this copy goes back to the head of the queue
        await exec("UPDATE reservations SET status = 'pending', copy_id = NULL, ready_at = NULL, expires_at = NULL WHERE copy_id = ? AND status = 'ready'", [id], c);
      }
      await exec('UPDATE book_copies SET status = ? WHERE id = ?', [b.status, id], c);
    }
    if (b.shelfLocation !== undefined) await exec('UPDATE book_copies SET shelf_location = ? WHERE id = ?', [b.shelfLocation, id], c);
    if (b.conditionNotes !== undefined) await exec('UPDATE book_copies SET condition_notes = ? WHERE id = ?', [b.conditionNotes, id], c);
    await allocateForBook(c, copy.book_id);
  });
  await audit(req, req.user!.id, 'copy.update', 'copy', id, b as any);
  ok(res, await queryOne(`${COPY_SQL} WHERE bc.id = ?`, [id]));
}));

copiesRouter.delete('/:id', wrap(async (req, res) => {
  const id = idParam(req);
  await withTx(async (c) => {
    const copy = await queryOne<any>('SELECT id, status FROM book_copies WHERE id = ? FOR UPDATE', [id], c);
    if (!copy) throw notFound('Copy');
    const loans = (await queryOne<any>('SELECT COUNT(*) AS n FROM loans WHERE copy_id = ?', [id], c))!.n;
    if (copy.status === 'on_loan' || copy.status === 'held' || loans) {
      throw unprocessable('This copy has circulation history. Mark it as withdrawn instead of deleting it.');
    }
    await exec('DELETE FROM book_copies WHERE id = ?', [id], c);
  });
  await audit(req, req.user!.id, 'copy.delete', 'copy', id);
  ok(res, { deleted: true });
}));
