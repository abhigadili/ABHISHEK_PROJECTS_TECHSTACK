import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { API, admin, app, issue, librarian, newBook, newMember, uniq } from './helpers';
import { queryOne } from '../src/lib/db';

const staffEndpoints: [string, string][] = [
  ['get', '/members'], ['get', '/staff'], ['get', '/loans'], ['get', '/fines'], ['get', '/payments'], ['get', '/reservations'],
  ['get', '/reports'], ['get', '/reports/inventory'], ['get', '/dashboard/staff'], ['get', '/audit-logs'], ['get', '/settings'],
  ['get', '/member-types/all'], ['get', '/reviews'], ['get', '/books/import/template'],
];
const adminOnly: [string, string][] = [['get', '/staff'], ['get', '/audit-logs'], ['get', '/member-types/all']];

describe('unauthorised access', () => {
  it('anonymous visitors get 401 on protected APIs but can browse the public catalog', async () => {
    for (const [m, u] of [...staffEndpoints, ['get', '/loans/mine'], ['get', '/notifications'], ['get', '/profile'], ['get', '/dashboard/member']]) {
      const r = await (request(app) as any)[m](API + u).set('X-LMS-Client', 'web'); expect(r.status, `${m} ${u}`).toBe(401);
    }
    for (const u of ['/books', '/books/1', '/categories', '/authors', '/publishers', '/member-types', '/settings/public', '/books/recent', '/books/popular', '/reviews/book/1']) {
      expect((await request(app).get(API + u)).status, u).toBe(200);
    }
  });

  it('members get 403 on every staff endpoint', async () => {
    const m = await newMember();
    for (const [method, u] of staffEndpoints) expect(((await (m.c as any)[method](u)).status), u).toBe(403);
    expect((await m.c.post('/staff').send({ fullName: 'Evil', email: 'e@e.co', role: 'admin' })).status).toBe(403);
    expect((await m.c.put('/settings').send({ settings: { library_name: 'hacked' } })).status).toBe(403);
    expect((await m.c.post('/loans/return').send({ loanId: 1 })).status).toBe(403);
    expect((await m.c.post('/member-types').send({})).status).toBe(403);
    expect((await m.c.post('/admin/jobs/run').send({})).status).toBe(403);
    expect((await m.c.post('/members').send({})).status).toBe(403);
  });

  it('librarians are blocked from admin-only functions but can run circulation', async () => {
    const lib = await librarian();
    for (const [, u] of adminOnly) expect((await lib.get(u)).status, u).toBe(403);
    expect((await lib.put('/settings').send({ settings: { library_name: 'x' } })).status).toBe(403);
    expect((await lib.post('/staff').send({ fullName: 'New Admin', email: `${uniq('a')}@x.co`, role: 'admin' })).status).toBe(403);
    expect((await lib.post('/member-types').send({})).status).toBe(403);
    expect((await lib.delete('/books/1')).status).toBe(403);
    expect((await lib.delete('/categories/1')).status).toBe(403);
    expect((await lib.get('/dashboard/staff')).status).toBe(200); expect((await lib.get('/reports/inventory')).status).toBe(200);
    expect((await lib.get('/settings')).status).toBe(200);
  });

  it("members cannot read or act on another member's data", async () => {
    const lib = await librarian(); const a = await newMember(); const b = await newMember(); const book = await newBook(lib);
    const loan = await issue(lib, a.id, book.id);
    expect((await b.c.get(`/loans/${loan.id}`)).status).toBe(403);
    expect((await a.c.get(`/loans/${loan.id}`)).status).toBe(200);
    expect((await b.c.get(`/loans/mine?memberId=${a.id}`)).body.meta.total).toBe(0);              // ?memberId ignored for members
    expect((await b.c.get(`/members/${a.id}`)).status).toBe(403);
    expect((await b.c.get(`/members/${a.id}/memberships`)).status).toBe(403);
    expect((await b.c.get(`/members/${b.id}`)).status).toBe(200);
    expect((await b.c.patch(`/members/${a.id}`).send({ city: 'X' })).status).toBe(403);
    expect((await b.c.post(`/members/${a.id}/status`).send({ status: 'suspended', reason: 'x' })).status).toBe(403);
    expect((await b.c.post(`/members/${b.id}/membership`).send({ memberTypeId: 4 })).status).toBe(403);   // cannot upgrade self
    expect((await b.c.post(`/loans/${loan.id}/renew`).send({})).status).toBe(403);
    const n = await queryOne<any>("SELECT id FROM notifications WHERE user_id = ? LIMIT 1", [a.id]);
    expect((await b.c.post(`/notifications/${n.id}/read`).send({})).status).toBe(404);
    expect((await b.c.get('/notifications')).body.data.every((x: any) => x.id !== n.id)).toBe(true);
  });

  it('only admins manage staff accounts, with self-lockout protections', async () => {
    const a = await admin();
    const created = await a.post('/staff').send({ fullName: 'Temp Lib', email: `${uniq('l')}@x.co`, role: 'librarian' });
    expect(created.status).toBe(201); expect(created.body.data.temporaryPassword).toBeTruthy();
    const me = (await a.get('/auth/me')).body.data.user;
    expect((await a.post(`/staff/${me.id}/status`).send({ status: 'inactive', reason: 'x' })).status).toBe(400);
    expect((await a.patch(`/staff/${me.id}`).send({ role: 'librarian' })).status).toBe(400);
    const sid = created.body.data.staff.id;
    expect((await a.post(`/staff/${sid}/status`).send({ status: 'suspended', reason: 'audit' })).status).toBe(200);
    const login = await request(app).post(`${API}/auth/login`).set('X-LMS-Client', 'web').send({ email: created.body.data.staff.email, password: created.body.data.temporaryPassword });
    expect(login.status).toBe(403);
  });

  it('gives sane errors for malformed input and unknown routes without leaking internals', async () => {
    const a = await admin();
    expect((await a.get('/books/abc')).status).toBe(400);
    expect((await a.get('/books/99999999')).status).toBe(404);
    const bad = await request(app).post(`${API}/auth/login`).set('X-LMS-Client', 'web').set('Content-Type', 'application/json').send('{bad json');
    expect(bad.status).toBe(400); expect(JSON.stringify(bad.body)).not.toMatch(/stack|node_modules|at /);
    const nf = await request(app).get('/api/v1/nope'); expect(nf.status).toBe(404); expect(nf.body.error.code).toBe('NOT_FOUND');
    const res = await request(app).get(`${API}/health`);
    expect(res.headers['x-powered-by']).toBeUndefined(); expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('applies CORS only for the configured frontend origin', async () => {
    const ok = await request(app).options(`${API}/books`).set('Origin', 'http://localhost:3000').set('Access-Control-Request-Method', 'GET');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000'); expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const bad = await request(app).options(`${API}/books`).set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'GET');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('never returns password hashes in any user-facing payload', async () => {
    const a = await admin(); const m = await newMember();
    for (const u of ['/members', `/members/${m.id}`, '/staff', '/auth/me', '/profile']) {
      expect(JSON.stringify((await a.get(u)).body), u).not.toMatch(/password|\$2[aby]\$/i);
    }
  });
});
