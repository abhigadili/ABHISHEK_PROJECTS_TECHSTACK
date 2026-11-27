import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { API, admin, app, issue, librarian, newBook, newMember, uniq } from './helpers';
import { queryOne } from '../src/lib/db';

const n = async (sql: string) => Number((await queryOne<any>(sql)).n);

describe('dashboards come from the database', () => {
  it('staff dashboard numbers equal live SQL counts and change when data changes', async () => {
    const lib = await librarian(); const m = await newMember(); const b = await newBook(lib, { copies: 2 });
    const d1 = (await lib.get('/dashboard/staff')).body.data;
    expect(d1.stats.totalBooks).toBe(await n("SELECT COUNT(*) n FROM books WHERE status='active'"));
    expect(d1.stats.availableCopies).toBe(await n("SELECT COUNT(*) n FROM book_copies WHERE status='available'"));
    expect(d1.stats.registeredMembers ?? d1.stats.totalMembers).toBe(await n('SELECT COUNT(*) n FROM users WHERE role_id=3'));
    expect(d1.trends).toHaveLength(12);
    await issue(lib, m.id, b.id);
    const d2 = (await lib.get('/dashboard/staff')).body.data;
    expect(d2.stats.activeLoans).toBe(d1.stats.activeLoans + 1); expect(d2.stats.availableCopies).toBe(d1.stats.availableCopies - 1);
    expect(d2.recentlyIssued[0].title).toBe(b.title);
    expect(d2.trends[11].issued).toBeGreaterThanOrEqual(1);
  });

  it('member dashboard shows only that member’s data', async () => {
    const lib = await librarian(); const a = await newMember(); const other = await newMember(); const b = await newBook(lib);
    await issue(lib, a.id, b.id); await lib.post('/fines').send({ memberId: a.id, amount: 3, reason: 'Late card' });
    const d = (await a.c.get('/dashboard/member')).body.data;
    expect(d.activeLoans).toHaveLength(1); expect(d.activeLoans[0].title).toBe(b.title); expect(d.outstandingFines).toBe(3);
    expect(d.profile.memberCode).toBe(a.code); expect(d.membership.typeName).toBe('General'); expect(d.notifications.length).toBeGreaterThan(0);
    const o = (await other.c.get('/dashboard/member')).body.data; expect(o.activeLoans).toHaveLength(0); expect(o.outstandingFines).toBe(0);
    expect((await a.c.get('/dashboard/staff')).status).toBe(403);
  });
});

describe('reports and CSV export', () => {
  it('lists reports, paginates JSON, filters by date and search', async () => {
    const lib = await librarian(); const m = await newMember(); const b = await newBook(lib); await issue(lib, m.id, b.id);
    const list = await lib.get('/reports'); expect(list.body.data.map((r: any) => r.key)).toEqual(expect.arrayContaining(['inventory', 'overdue-loans', 'payment-history', 'most-borrowed']));
    const r = await lib.get('/reports/issue-return-history?pageSize=5&q=' + encodeURIComponent(b.title));
    expect(r.body.data).toHaveLength(1); expect(r.body.data[0]).toMatchObject({ title: b.title, member: 'Test Member', status: 'active' });
    const today = new Date().toISOString().slice(0, 10);
    expect((await lib.get(`/reports/issue-return-history?from=${today}&to=${today}&q=${encodeURIComponent(b.title)}`)).body.meta.total).toBe(1);
    expect((await lib.get(`/reports/issue-return-history?from=2000-01-01&to=2000-01-02&q=${encodeURIComponent(b.title)}`)).body.meta.total).toBe(0);
    expect((await lib.get('/reports/nope')).status).toBe(404);
    for (const key of list.body.data.map((x: any) => x.key)) expect((await lib.get(`/reports/${key}?pageSize=3`)).status, key).toBe(200);
  });

  it('exports CSV with the same authorisation, correct headers and spreadsheet-injection protection', async () => {
    const lib = await librarian(); const m = await newMember();
    const evil = await newBook(lib, { title: '=HYPERLINK("http://evil.example","x"),with,comma' });
    const r = await lib.get('/reports/inventory?format=csv&q=HYPERLINK');
    expect(r.status).toBe(200); expect(r.headers['content-type']).toMatch(/text\/csv/); expect(r.headers['content-disposition']).toMatch(/inventory-\d{4}-\d{2}-\d{2}\.csv/);
    const lines = r.text.trim().split('\r\n'); expect(lines[0]).toContain('title,authors');
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://evil.example"",""x""),with,comma"`);
    expect(lines[1].startsWith('=')).toBe(false);
    expect((await m.c.get('/reports/inventory?format=csv')).status).toBe(403);
    expect((await request(app).get(`${API}/reports/inventory?format=csv`)).status).toBe(401);
    void evil;
  });
});

describe('CSV book import', () => {
  const upload = (c: any, csv: string, q = '') => c.post('/books/import' + q).attach('file', Buffer.from(csv), { filename: 'books.csv', contentType: 'text/csv' });
  it('imports valid rows (authors/categories/publisher created or reused, copies added)', async () => {
    const lib = await librarian(); const t = uniq('Imp');
    const csv = `title,authors,categories,publisher,isbn13,publication_year,format,copies,shelf\n"${t} One","${t} Author; George Orwell","Fiction;${t} Cat","${t} Pub",9781861972712,2019,hardcover,2,I-1\n"${t} Two, the sequel",${t} Author,,,,2020,,1,\n`;
    const dry = await upload(lib, csv, '?dryRun=1'); expect(dry.body.data).toMatchObject({ valid: true, rows: 2, imported: 0 });
    expect(await n(`SELECT COUNT(*) n FROM books WHERE title LIKE '${t}%'`)).toBe(0);
    const r = await upload(lib, csv); expect(r.status).toBe(201); expect(r.body.data.imported).toBe(2);
    expect(await n(`SELECT COUNT(*) n FROM books WHERE title LIKE '${t}%'`)).toBe(2);
    expect(await n(`SELECT COUNT(*) n FROM authors WHERE name = '${t} Author'`)).toBe(1);
    expect(await n(`SELECT COUNT(*) n FROM book_copies bc JOIN books b ON b.id = bc.book_id WHERE b.title LIKE '${t}%'`)).toBe(3);
    const found = await lib.get(`/books?q=${encodeURIComponent(t + ' One')}`); expect(found.body.data[0]).toMatchObject({ publisherName: `${t} Pub`, format: 'hardcover', totalCopies: 2 });
    expect((await upload(lib, csv)).status).toBe(422);                                                  // ISBN now exists
  });

  it('rejects the whole file when any row is invalid and writes nothing', async () => {
    const lib = await librarian(); const t = uniq('Bad');
    const csv = `title,authors,isbn13,copies\n"${t} ok",A. Writer,,1\n"${t} bad isbn",A. Writer,1234567890123,1\n,,,\n"${t} no author",,,1\n`;
    const r = await upload(lib, csv);
    expect(r.status).toBe(422); expect(r.body.error.details.map((d: any) => d.line)).toEqual(expect.arrayContaining([3, 4]));
    expect(await n(`SELECT COUNT(*) n FROM books WHERE title LIKE '${t}%'`)).toBe(0);
    expect((await upload(lib, 'name,author\nx,y\n')).status).toBe(400);
    const m = await newMember(); expect((await upload(m.c, csv)).status).toBe(403);
  });
});

describe('settings, audit log, membership types', () => {
  it('admin edits policy in the database and it takes effect immediately; audit log records it', async () => {
    const a = await admin(); const lib = await librarian(); const m = await newMember();
    expect((await a.put('/settings').send({ settings: { nope: 1 } })).status).toBe(422);
    expect((await a.put('/settings').send({ settings: { max_outstanding_balance: -5 } })).status).toBe(422);
    expect((await a.put('/settings').send({ settings: { block_borrowing_if_overdue: 'maybe' } })).status).toBe(422);
    await lib.post('/fines').send({ memberId: m.id, amount: 4, reason: 'Policy test' });
    const book = async () => (await newBook(lib)).id;
    expect((await lib.post('/loans/issue').send({ memberId: m.id, bookId: await book() })).status).toBe(201);        // 4 < limit 10
    await a.put('/settings').send({ settings: { max_outstanding_balance: 3 } });
    expect((await lib.post('/loans/issue').send({ memberId: m.id, bookId: await book() })).status).toBe(422);        // 4 >= new limit 3
    await a.put('/settings').send({ settings: { max_outstanding_balance: 10 } });
    const log = await a.get('/audit-logs?action=settings.update'); expect(log.body.data[0]).toMatchObject({ action: 'settings.update', actorName: 'Alice Admin' });
    expect(JSON.parse(JSON.stringify(log.body.data[0].details))).toHaveProperty('max_outstanding_balance');
    expect((await request(app).get(`${API}/settings/public`)).body.data.name).toBeTruthy();
  });

  it('records sensitive actions in the audit log', async () => {
    const a = await admin(); const lib = await librarian(); const m = await newMember(); const b = await newBook(lib);
    await lib.post('/fines').send({ memberId: m.id, amount: 2, reason: 'Audit' }); await a.post(`/members/${m.id}/status`).send({ status: 'suspended', reason: 'audit' });
    const actions = (await a.get('/audit-logs?pageSize=100')).body.data.map((x: any) => x.action);
    expect(actions).toEqual(expect.arrayContaining(['book.create', 'fine.create', 'member.suspended', 'member.register']));
    expect(b.id).toBeGreaterThan(0);
  });

  it('admin edits membership types; changes drive loan periods', async () => {
    const a = await admin(); const lib = await librarian();
    const t = await a.post('/member-types').send({ name: uniq('Gold '), maxLoans: 2, loanDays: 7, maxRenewals: 1, renewalDays: 7, maxReservations: 2, finePerDay: 1, graceDays: 0, maxFinePerLoan: 5, membershipDays: 30, membershipFee: 0, isActive: true });
    expect(t.status).toBe(201);
    const m = await newMember({ memberTypeId: t.body.data.id });
    const loan = await issue(lib, m.id, (await newBook(lib)).id);
    const days = Math.round((Date.parse(loan.dueDate) - Date.parse(new Date().toISOString().slice(0, 10))) / 86_400_000); expect(days).toBe(7);
    await issue(lib, m.id, (await newBook(lib)).id);
    expect((await lib.post('/loans/issue').send({ memberId: m.id, bookId: (await newBook(lib)).id })).status).toBe(422);   // limit 2
    expect((await a.post('/member-types').send({ name: 'x' })).status).toBe(400);
    expect((await a.get('/member-types')).body.data.length).toBeGreaterThanOrEqual(5);
  });

  it('staff register members (temporary password), change membership and manage status with reasons', async () => {
    const lib = await librarian(); const email = `${uniq('s')}@example.org`;
    const r = await lib.post('/members').send({ fullName: 'Walk In', email, phone: '555-0100', address: '1 St', city: 'Town', postalCode: '1', country: 'US', memberTypeId: 1 });
    expect(r.status).toBe(201); expect(r.body.data.temporaryPassword).toBeTruthy();
    const id = r.body.data.member.id;
    expect((await lib.post('/members').send({ fullName: 'Dup', email, phone: '555-0100', address: '1 St', city: 'Town', postalCode: '1', country: 'US', memberTypeId: 1 })).status).toBe(409);
    expect((await lib.post(`/members/${id}/status`).send({ status: 'suspended' })).status).toBe(400);               // reason required
    const hist = await lib.post(`/members/${id}/membership`).send({ memberTypeId: 4 }); expect(hist.body.data.policy.typeName).toBe('Premium');
    expect((await lib.get(`/members/${id}/memberships`)).body.data).toHaveLength(2);
    const list = await lib.get(`/members?q=${encodeURIComponent('Walk In')}&status=active`); expect(list.body.data.some((x: any) => x.id === id)).toBe(true);
  });
});

describe('notifications, favourites and reviews', () => {
  it('lists, counts and marks notifications read (own only)', async () => {
    const lib = await librarian(); const m = await newMember(); await issue(lib, m.id, (await newBook(lib)).id);
    const l = await m.c.get('/notifications'); expect(l.body.meta.unread).toBeGreaterThanOrEqual(2); expect(l.body.data[0]).toMatchObject({ isRead: false });
    const one = l.body.data[0]; expect((await m.c.post(`/notifications/${one.id}/read`).send({})).status).toBe(200);
    expect((await m.c.get('/notifications/unread-count')).body.data.unread).toBe(l.body.meta.unread - 1);
    expect((await m.c.post('/notifications/read-all').send({})).status).toBe(200);
    expect((await m.c.get('/notifications/unread-count')).body.data.unread).toBe(0);
    expect(l.body.data.find((x: any) => x.type === 'loan_issued').link).toBe('/member/loans');
  });

  it('favourites toggle and show in the reading list', async () => {
    const lib = await librarian(); const m = await newMember(); const b = await newBook(lib);
    expect((await m.c.put(`/favorites/${b.id}`).send({})).body.data.isFavorite).toBe(true);
    expect((await m.c.get(`/books/${b.id}`)).body.data.isFavorite).toBe(true);
    expect((await m.c.get('/favorites')).body.data.map((x: any) => x.id)).toContain(b.id);
    expect((await m.c.delete(`/favorites/${b.id}`)).body.data.isFavorite).toBe(false);
    expect((await m.c.put('/favorites/999999').send({})).status).toBe(404);
  });

  it('reviews need a prior loan, one per member, with optional moderation', async () => {
    const a = await admin(); const lib = await librarian(); const m = await newMember(); const b = await newBook(lib);
    expect((await m.c.put(`/reviews/book/${b.id}`).send({ rating: 5 })).status).toBe(422);
    const loan = await issue(lib, m.id, b.id); await lib.post('/loans/return').send({ loanId: loan.id });
    expect((await m.c.put(`/reviews/book/${b.id}`).send({ rating: 6 })).status).toBe(400);
    expect((await m.c.put(`/reviews/book/${b.id}`).send({ rating: 4, comment: 'Good' })).body.data.status).toBe('approved');
    expect((await m.c.put(`/reviews/book/${b.id}`).send({ rating: 5, comment: 'Great' })).status).toBe(200);
    const det = (await m.c.get(`/books/${b.id}`)).body.data; expect(det).toMatchObject({ avgRating: 5, ratingCount: 1 });
    await a.put('/settings').send({ settings: { review_moderation: true } });
    expect((await m.c.put(`/reviews/book/${b.id}`).send({ rating: 3, comment: 'Meh' })).body.data.status).toBe('pending');
    expect((await request(app).get(`${API}/reviews/book/${b.id}`)).body.data).toHaveLength(0);                   // hidden from the public until approved
    const q = await lib.get('/reviews?status=pending'); const rid = q.body.data.find((x: any) => x.bookId === b.id).id;
    expect((await lib.post(`/reviews/${rid}/moderate`).send({ status: 'approved' })).status).toBe(200);
    expect((await request(app).get(`${API}/reviews/book/${b.id}`)).body.data).toHaveLength(1);
    await a.put('/settings').send({ settings: { review_moderation: false } });
  });
});
