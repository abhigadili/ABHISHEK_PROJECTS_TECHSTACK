import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { API, JPEG, PNG, WEBP, app, librarian, newMember, login } from './helpers';
import { closePool, queryOne } from '../src/lib/db';
import { createApp } from '../src/app';

describe('profile', () => {
  it('returns and updates the own profile', async () => {
    const m = await newMember();
    const g = await m.c.get('/profile');
    expect(g.status).toBe(200); expect(g.body.data.memberCode).toBe(m.code); expect(g.body.data.city).toBe('Springfield');
    const u = await m.c.patch('/profile').send({ fullName: 'Renamed Person', city: 'Shelbyville', gender: 'female' });
    expect(u.status).toBe(200); expect(u.body.data.fullName).toBe('Renamed Person');
    expect((await m.c.get('/profile')).body.data.city).toBe('Shelbyville');
    expect((await m.c.patch('/profile').send({ phone: 'abc' })).status).toBe(400);
    expect((await m.c.patch('/profile').send({ email: 'x@y.zz', role: 'admin' })).body.data.role).toBe('member');
  });
});

describe('profile picture', () => {
  it('upload, serve with correct headers, replace, ETag revalidation, remove', async () => {
    const m = await newMember();
    expect((await m.c.get(`/users/${m.id}/picture`)).status).toBe(404);

    const up = await m.c.put(`/users/${m.id}/picture`).attach('picture', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(up.status).toBe(200);
    const g = await m.c.get(`/users/${m.id}/picture`).buffer(true).parse((res, cb) => { const d: Buffer[] = []; res.on('data', (x: Buffer) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); });
    expect(g.status).toBe(200); expect(g.headers['content-type']).toBe('image/png');
    expect(g.headers['cache-control']).toMatch(/private/); expect(g.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(g.body as Buffer, PNG)).toBe(0);
    const etag = g.headers.etag;
    expect((await m.c.get(`/users/${m.id}/picture`).set('If-None-Match', etag)).status).toBe(304);

    const rep = await m.c.put(`/users/${m.id}/picture`).attach('picture', JPEG, { filename: 'b.jpg', contentType: 'image/jpeg' });
    expect(rep.body.data.mimeType).toBe('image/jpeg');
    const row = await queryOne<any>('SELECT mime_type, LENGTH(data) AS len FROM user_images WHERE user_id = ?', [m.id]);
    expect(row).toMatchObject({ mime_type: 'image/jpeg', len: JPEG.length });
    expect((await m.c.put(`/users/${m.id}/picture`).attach('picture', WEBP, { filename: 'c.webp', contentType: 'image/webp' })).status).toBe(200);

    expect((await m.c.get('/profile')).body.data.hasPicture).toBe(true);
    expect((await m.c.delete(`/users/${m.id}/picture`)).status).toBe(200);
    expect(await queryOne('SELECT 1 FROM user_images WHERE user_id = ?', [m.id])).toBeNull();
    expect((await m.c.get('/profile')).body.data.hasPicture).toBe(false);
  });

  it('rejects missing file and fake images', async () => {
    const m = await newMember();
    expect((await m.c.put(`/users/${m.id}/picture`).field('x', 'y')).status).toBe(400);
    expect((await m.c.put(`/users/${m.id}/picture`).attach('picture', Buffer.from('MZ not an image......'), { filename: 'e.png', contentType: 'image/png' })).status).toBe(400);
  });

  it('members cannot touch other members pictures; librarians can manage members only', async () => {
    const a = await newMember(); const b = await newMember(); const lib = await librarian();
    await a.c.put(`/users/${a.id}/picture`).attach('picture', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect((await b.c.get(`/users/${a.id}/picture`)).status).toBe(403);
    expect((await b.c.put(`/users/${a.id}/picture`).attach('picture', PNG, { filename: 'a.png', contentType: 'image/png' })).status).toBe(403);
    expect((await b.c.delete(`/users/${a.id}/picture`)).status).toBe(403);
    expect((await lib.get(`/users/${a.id}/picture`)).status).toBe(200);
    expect((await lib.put(`/users/${a.id}/picture`).attach('picture', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' })).status).toBe(200);
    expect((await request(app).get(`${API}/users/${a.id}/picture`)).status).toBe(401);
    const adminId = (await queryOne<any>("SELECT id FROM users WHERE email = 'admin@library.local'")).id;
    expect((await lib.put(`/users/${adminId}/picture`).attach('picture', PNG, { filename: 'a.png', contentType: 'image/png' })).status).toBe(403);
  });

  it('survives an application restart because bytes live in MySQL', async () => {
    const m = await newMember();
    await m.c.put(`/users/${m.id}/picture`).attach('picture', PNG, { filename: 'a.png', contentType: 'image/png' });
    await closePool();                       // drop every DB connection and the in-process pool ...
    const restarted = createApp();           // ... and boot a brand-new app instance
    const agent = request.agent(restarted);
    const r = await agent.post(`${API}/auth/login`).set('X-LMS-Client', 'web').send({ email: m.email, password: 'Test#Pass123' });
    expect(r.status).toBe(200);
    const g = await agent.get(`${API}/users/${m.id}/picture`).buffer(true).parse((res, cb) => { const d: Buffer[] = []; res.on('data', (x: Buffer) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); });
    expect(g.status).toBe(200); expect(Buffer.compare(g.body as Buffer, PNG)).toBe(0);
    void login;
  });
});
