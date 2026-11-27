import { describe, expect, it } from 'vitest';
import { admin, copiesOf, issue, librarian, newBook, newMember, uniq } from './helpers';
import { queryOne } from '../src/lib/db';

describe('book catalog', () => {
  it('staff create a book with authors, categories, publisher and N copies (accession numbers unique)', async () => {
    const lib = await librarian();
    const r = await lib.post('/books').send({ title: 'The Test Book', subtitle: 'Vol 1', authorIds: [1, 2], categoryIds: [1, 3], publisherId: 1, isbn13: '978-0-13-235088-4'.replace('0132350884', '0132350884'), isbn10: '', publicationYear: 2020, language: 'English', pages: 100, format: 'hardcover', copies: 3, location: 'Z-01', acquisitionCost: 12.5 });
    // ISBN above duplicates seeded "Clean Code" -> conflict, so use a fresh valid one
    expect(r.status).toBe(409);
    const ok = await lib.post('/books').send({ title: 'The Test Book', subtitle: 'Vol 1', authorIds: [1, 2], categoryIds: [1, 3], publisherId: 1, isbn13: '9780306406157', publicationYear: 2020, copies: 3, location: 'Z-01', format: 'hardcover' });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ totalCopies: 3, availableCopies: 3, borrowedCopies: 0, availability: 'available' });
    const copies = await copiesOf(ok.body.data.id);
    expect(new Set(copies.map((c) => c.accession_number)).size).toBe(3);
    const det = await lib.get(`/books/${ok.body.data.id}`);
    expect(det.body.data.authorList).toHaveLength(2); expect(det.body.data.categoryList).toHaveLength(2);
  });

  it('supports books without ISBN and rejects invalid / duplicate ISBNs and bad input', async () => {
    const lib = await librarian();
    expect((await lib.post('/books').send({ title: uniq('NoIsbn '), authorIds: [1] })).status).toBe(201);
    const bad = await lib.post('/books').send({ title: uniq('Bad '), authorIds: [1], isbn13: '9780132350885' });
    expect(bad.status).toBe(400); expect(bad.body.error.details.isbn13).toMatch(/Invalid/);
    expect((await lib.post('/books').send({ title: '', authorIds: [] })).status).toBe(400);
    expect((await lib.post('/books').send({ title: uniq('x '), authorIds: [99999] })).status).toBe(400);
    expect((await lib.post('/books').send({ title: uniq('x '), authorIds: [1], coverUrl: 'javascript:alert(1)' })).status).toBe(400);
  });

  it('edits a book and replaces its author/category links', async () => {
    const lib = await librarian(); const b = await newBook(lib);
    const u = await lib.put(`/books/${b.id}`).send({ title: 'Edited Title', authorIds: [3], categoryIds: [10], publicationYear: 2001, language: 'French', format: 'ebook' });
    expect(u.status).toBe(200); expect(u.body.data).toMatchObject({ title: 'Edited Title', language: 'French', authors: 'Robert C. Martin', categories: 'Programming' });
    expect((await lib.put('/books/999999').send({ title: 'x', authorIds: [1] })).status).toBe(404);
  });

  it('members cannot create or edit books', async () => {
    const m = await newMember();
    expect((await m.c.post('/books').send({ title: 'x', authorIds: [1] })).status).toBe(403);
    expect((await m.c.put('/books/1').send({ title: 'x', authorIds: [1] })).status).toBe(403);
    expect((await m.c.post('/books/1/copies').send({})).status).toBe(403);
  });

  it('searches and filters from MySQL, with pagination and sorting', async () => {
    const c = (await newMember()).c;
    const q = await c.get('/books?q=orwell');
    expect(q.body.data.map((b: any) => b.title)).toContain('1984');
    expect((await c.get('/books?q=9780451524935')).body.data[0].title).toBe('1984');
    expect((await c.get('/books?author=Austen')).body.data.map((b: any) => b.title)).toContain('Pride and Prejudice');
    expect((await c.get('/books?categoryId=9')).body.data.length).toBeGreaterThanOrEqual(4);       // Technology + Programming/Databases children
    expect((await c.get('/books?publisherId=3&format=hardcover')).body.data.every((b: any) => b.format === 'hardcover')).toBe(true);
    const yr = await c.get('/books?yearFrom=2015&yearTo=2018');
    expect(yr.body.data.every((b: any) => b.publicationYear >= 2015 && b.publicationYear <= 2018)).toBe(true);
    const p1 = await c.get('/books?pageSize=5&page=1&sort=title'); const p2 = await c.get('/books?pageSize=5&page=2&sort=title');
    expect(p1.body.meta).toMatchObject({ page: 1, pageSize: 5 }); expect(p1.body.meta.total).toBeGreaterThan(10);
    expect(p1.body.data).toHaveLength(5); expect(p2.body.data[0].title > p1.body.data[4].title).toBe(true);
    const none = await c.get('/books?q=zzzznomatchzzzz'); expect(none.body.data).toEqual([]); expect(none.body.meta.total).toBe(0);
    expect((await c.get('/books?sort=year')).status).toBe(200);
    expect((await c.get("/books?q=' OR 1=1 --")).body.data).toEqual([]);                              // injection attempt is just text
  });

  it('availability filter, popularity from real loans, and recent/popular lists', async () => {
    const lib = await librarian(); const b = await newBook(lib, { copies: 1 }); const m = await newMember();
    await issue(lib, m.id, b.id);
    const un = await m.c.get('/books?availability=unavailable&q=' + encodeURIComponent(b.title));
    expect(un.body.data[0]).toMatchObject({ id: b.id, availableCopies: 0, borrowedCopies: 1, availability: 'borrowed', timesBorrowed: 1 });
    expect((await m.c.get('/books?availability=available&q=' + encodeURIComponent(b.title))).body.data).toHaveLength(0);
    const pop = (await m.c.get('/books/popular')).body.data; expect(pop.length).toBeGreaterThan(0);
    expect(pop.every((x: any, i: number) => x.timesBorrowed > 0 && (i === 0 || pop[i - 1].timesBorrowed >= x.timesBorrowed))).toBe(true);
    expect((await m.c.get('/books/recent?limit=3')).body.data).toHaveLength(3);
    const det = await m.c.get(`/books/${b.id}`); expect(det.body.data.myActiveLoan).toBeTruthy(); expect(det.body.data).not.toHaveProperty('acquisitionCost');
  });
});

describe('copies and inventory consistency', () => {
  it('adds copies, changes status, and counts always match physical copy records', async () => {
    const lib = await librarian(); const b = await newBook(lib, { copies: 2 });
    const add = await lib.post(`/books/${b.id}/copies`).send({ count: 2, shelfLocation: 'Q-9' });
    expect(add.status).toBe(201); expect(add.body.data).toHaveLength(4);
    const dup = await lib.post(`/books/${b.id}/copies`).send({ accessionNumber: add.body.data[0].accessionNumber });
    expect(dup.status).toBe(409);
    const ids = (await copiesOf(b.id)).map((c) => c.id);
    expect((await lib.patch(`/copies/${ids[0]}`).send({ status: 'damaged' })).status).toBe(200);
    expect((await lib.patch(`/copies/${ids[1]}`).send({ status: 'lost' })).status).toBe(200);
    expect((await lib.patch(`/copies/${ids[2]}`).send({ status: 'withdrawn' })).status).toBe(200);
    const d = (await lib.get(`/books/${b.id}`)).body.data;
    expect(d).toMatchObject({ totalCopies: 3, availableCopies: 1, damagedCopies: 1, lostCopies: 1 });
    const db = await queryOne<any>("SELECT SUM(status='available') a, SUM(status<>'withdrawn') t FROM book_copies WHERE book_id = ?", [b.id]);
    expect([Number(db.a), Number(db.t)]).toEqual([d.availableCopies, d.totalCopies]);
    expect((await lib.delete(`/copies/${ids[3]}`)).status).toBe(200);          // never loaned -> may be deleted
  });

  it('blocks deleting/archiving books and copies with circulation records', async () => {
    const lib = await librarian(); const a = await admin(); const b = await newBook(lib); const m = await newMember();
    const loan = await issue(lib, m.id, b.id);
    expect((await lib.patch(`/copies/${loan.copyId}`).send({ status: 'damaged' })).status).toBe(422);   // on loan
    expect((await lib.delete(`/copies/${loan.copyId}`)).status).toBe(422);
    expect((await lib.post(`/books/${b.id}/archive`)).status).toBe(422);
    expect((await a.delete(`/books/${b.id}`)).status).toBe(422);
    expect((await lib.delete(`/books/${b.id}`)).status).toBe(403);                                        // only admins delete
    await lib.post('/loans/return').send({ loanId: loan.id });
    expect((await a.delete(`/books/${b.id}`)).status).toBe(422);                                          // history remains -> archive only
    expect((await lib.post(`/books/${b.id}/archive`)).status).toBe(200);
    expect((await m.c.get(`/books/${b.id}`)).status).toBe(404);                                           // hidden from members
    expect((await lib.get(`/books/${b.id}`)).status).toBe(200);
    expect((await lib.post(`/books/${b.id}/restore`)).status).toBe(200);
    const fresh = await newBook(lib);
    expect((await a.delete(`/books/${fresh.id}`)).status).toBe(200);                                       // no history -> hard delete OK
    expect(await queryOne('SELECT 1 FROM book_copies WHERE book_id = ?', [fresh.id])).toBeNull();
  });
});

describe('categories, authors, publishers', () => {
  it('CRUD with validation, hierarchy, and archive-instead-of-delete', async () => {
    const lib = await librarian(); const a = await admin();
    const parent = await lib.post('/categories').send({ name: uniq('Parent ') });
    expect(parent.status).toBe(201); expect(parent.body.data.slug).toMatch(/^parent-/);
    const child = await lib.post('/categories').send({ name: uniq('Child '), parentId: parent.body.data.id });
    expect(child.body.data.parentName).toBe(parent.body.data.name);
    expect((await lib.post('/categories').send({ name: parent.body.data.name })).status).toBe(409);
    expect((await lib.put(`/categories/${parent.body.data.id}`).send({ name: parent.body.data.name, parentId: child.body.data.id })).status).toBe(400);   // cycle
    const del = await a.delete(`/categories/${parent.body.data.id}`); expect(del.body.data.archived).toBe(true);
    expect((await a.delete(`/categories/${child.body.data.id}`)).body.data.deleted).toBe(true);
    expect((await lib.delete(`/categories/${parent.body.data.id}`)).status).toBe(403);

    const au = await lib.post('/authors').send({ name: uniq('Author '), nationality: 'Kenyan', dateOfBirth: '1970-01-01' });
    expect(au.status).toBe(201);
    const pub = await lib.post('/publishers').send({ name: uniq('Pub '), website: 'https://example.org', email: 'a@b.co' });
    expect(pub.status).toBe(201);
    expect((await lib.post('/publishers').send({ name: pub.body.data.name })).status).toBe(409);
    expect((await lib.post('/publishers').send({ name: uniq('P '), website: 'ftp://x' })).status).toBe(400);
    const b = await newBook(lib, { authorIds: [au.body.data.id], publisherId: pub.body.data.id });
    const detail = await lib.get(`/authors/${au.body.data.id}`); expect(detail.body.data.books.map((x: any) => x.id)).toContain(b.id);
    expect((await a.delete(`/authors/${au.body.data.id}`)).body.data.archived).toBe(true);
    expect((await a.delete(`/publishers/${pub.body.data.id}`)).body.data.archived).toBe(true);
  });
});
