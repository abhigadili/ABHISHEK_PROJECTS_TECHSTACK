import { Router } from 'express';
import type { PoolConnection } from 'mysql2/promise';
import { query, queryOne, exec, withTx } from '../lib/db';
import { audit } from '../lib/audit';
import { badRequest } from '../lib/errors';
import { ok, wrap } from '../lib/http';
import { parseCsv } from '../lib/csv';
import { csvUpload } from '../lib/images';
import { slugify, validIsbn10, validIsbn13 } from '../lib/slug';
import { requireAuth, staffOnly } from '../middleware/auth';
import { addCopies } from './books';

export const importRouter = Router();
const MAX_ROWS = 1000;
const FORMATS = ['hardcover', 'paperback', 'ebook', 'audiobook', 'other'];

export const IMPORT_TEMPLATE = 'title,subtitle,authors,categories,publisher,isbn10,isbn13,publication_year,language,pages,format,copies,shelf,description\n';

interface Parsed { line: number; title: string; subtitle: string | null; authors: string[]; categories: string[]; publisher: string | null; isbn10: string | null; isbn13: string | null;
  year: number | null; language: string; pages: number | null; format: string; copies: number; shelf: string | null; description: string | null }

function validateRows(rows: string[][]) {
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (n: string) => header.indexOf(n);
  if (idx('title') < 0 || idx('authors') < 0) throw badRequest('CSV must have at least the columns: title, authors');
  const errors: { line: number; message: string }[] = []; const ok_: Parsed[] = [];
  const seen = new Set<string>();
  rows.slice(1).forEach((r, i) => {
    const line = i + 2; const cell = (n: string) => (idx(n) >= 0 ? (r[idx(n)] ?? '').trim() : '');
    const err = (m: string) => errors.push({ line, message: m });
    const title = cell('title'); const authors = cell('authors').split(/[;|]/).map((s) => s.trim()).filter(Boolean);
    if (!title) err('title is required'); if (title.length > 255) err('title is too long');
    if (!authors.length) err('at least one author is required');
    const isbn10 = cell('isbn10').replace(/[-\s]/g, '').toUpperCase() || null; const isbn13 = cell('isbn13').replace(/[-\s]/g, '') || null;
    if (isbn10 && !validIsbn10(isbn10)) err(`invalid ISBN-10 "${isbn10}"`);
    if (isbn13 && !validIsbn13(isbn13)) err(`invalid ISBN-13 "${isbn13}"`);
    for (const k of [isbn10, isbn13]) if (k) { if (seen.has(k)) err(`duplicate ISBN ${k} in file`); seen.add(k); }
    const yr = cell('publication_year'); const year = yr ? Number(yr) : null;
    if (yr && (!Number.isInteger(year) || year! < 1000 || year! > new Date().getFullYear() + 1)) err('invalid publication_year');
    const pg = cell('pages'); const pages = pg ? Number(pg) : null;
    if (pg && (!Number.isInteger(pages) || pages! < 1 || pages! > 20000)) err('invalid pages');
    const format = (cell('format') || 'paperback').toLowerCase();
    if (!FORMATS.includes(format)) err(`format must be one of ${FORMATS.join(', ')}`);
    const cp = cell('copies'); const copies = cp ? Number(cp) : 1;
    if (!Number.isInteger(copies) || copies < 0 || copies > 200) err('copies must be 0-200');
    ok_.push({ line, title, subtitle: cell('subtitle') || null, authors, categories: cell('categories').split(/[;|]/).map((s) => s.trim()).filter(Boolean),
      publisher: cell('publisher') || null, isbn10, isbn13, year, language: cell('language') || 'English', pages, format, copies, shelf: cell('shelf') || null, description: cell('description') || null });
  });
  return { parsed: ok_, errors };
}

async function findOrCreate(c: PoolConnection, table: 'authors' | 'categories' | 'publishers', name: string): Promise<number> {
  const hit = await queryOne<any>(`SELECT id FROM ${table} WHERE name = ?`, [name], c);
  if (hit) return hit.id;
  if (table === 'categories') {
    let slug = slugify(name); let n = 1;
    while (await queryOne('SELECT 1 FROM categories WHERE slug = ?', [slug], c)) slug = `${slugify(name)}-${++n}`;
    return (await exec('INSERT INTO categories (name, slug) VALUES (?,?)', [name, slug], c)).insertId;
  }
  return (await exec(`INSERT INTO ${table} (name) VALUES (?)`, [name], c)).insertId;
}

importRouter.get('/template', requireAuth, staffOnly, (_req, res) => {
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="books-import-template.csv"' }).send(IMPORT_TEMPLATE);
});

// All-or-nothing: any invalid row rejects the whole file, nothing is written.
importRouter.post('/', requireAuth, staffOnly, csvUpload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw badRequest('Choose a CSV file');
  const rows = parseCsv(req.file.buffer.toString('utf8'));
  if (rows.length < 2) throw badRequest('The CSV has no data rows');
  if (rows.length - 1 > MAX_ROWS) throw badRequest(`At most ${MAX_ROWS} rows per import`);
  const { parsed, errors } = validateRows(rows);
  for (const p of parsed) {
    for (const [col, val] of [['isbn10', p.isbn10], ['isbn13', p.isbn13]] as const) {
      if (val && await queryOne(`SELECT 1 FROM books WHERE ${col} = ?`, [val])) errors.push({ line: p.line, message: `a book with ${col.toUpperCase()} ${val} already exists` });
    }
  }
  const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
  if (errors.length) return void res.status(422).json({ error: { code: 'IMPORT_INVALID', message: `${errors.length} problem(s) found - nothing was imported`, details: errors.slice(0, 200) } });
  if (dryRun) return ok(res, { valid: true, rows: parsed.length, imported: 0 });
  const ids = await withTx(async (c) => {
    const out: number[] = [];
    for (const p of parsed) {
      const pubId = p.publisher ? await findOrCreate(c, 'publishers', p.publisher) : null;
      const r = await exec(`INSERT INTO books (isbn10, isbn13, title, subtitle, description, publisher_id, publication_year, language, pages, location, format, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [p.isbn10, p.isbn13, p.title, p.subtitle, p.description, pubId, p.year, p.language, p.pages, p.shelf, p.format, req.user!.id], c);
      let pos = 0;
      for (const a of new Set(p.authors)) await exec('INSERT IGNORE INTO book_authors (book_id, author_id, position) VALUES (?,?,?)', [r.insertId, await findOrCreate(c, 'authors', a), pos++], c);
      for (const cat of new Set(p.categories)) await exec('INSERT IGNORE INTO book_categories (book_id, category_id) VALUES (?,?)', [r.insertId, await findOrCreate(c, 'categories', cat)], c);
      if (p.copies) await addCopies(c, r.insertId, p.copies, p.shelf);
      out.push(r.insertId);
    }
    return out;
  });
  await audit(req, req.user!.id, 'book.import', 'book', null, { rows: ids.length });
  ok(res, { imported: ids.length }, 201);
}));
void query;
